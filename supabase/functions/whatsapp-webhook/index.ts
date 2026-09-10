import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Recebe os eventos da Evolution API.
 *
 * Roda SEM verificação de JWT — a Evolution não tem como emitir um token do
 * Supabase. A porta é fechada por um segredo no final da URL, que é o que a
 * Evolution consegue carregar (ela não assina o corpo do webhook).
 *
 * Hoje trata duas coisas: o estado da conexão e a confirmação do número por
 * PIN. O agente que entende áudio e lança no sistema entra depois, no lugar
 * marcado em `responderMembro`.
 */

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')!
const WEBHOOK_SEGREDO = Deno.env.get('WEBHOOK_SEGREDO')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

/** Seis dígitos isolados na mensagem. É o formato do PIN de confirmação. */
const PIN = /\b(\d{6})\b/

async function enviar(instancia: string, numero: string, texto: string) {
  await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: numero, text: texto }),
  }).catch(() => {
    // Falha ao responder não pode derrubar o webhook: a Evolution reenviaria
    // o mesmo evento e o efeito no banco aconteceria duas vezes.
  })
}

/** O texto vem em campos diferentes conforme o tipo da mensagem. */
function textoDaMensagem(m: Record<string, unknown> | undefined): string {
  if (!m) return ''
  const estendida = m.extendedTextMessage as Record<string, unknown> | undefined
  const imagem = m.imageMessage as Record<string, unknown> | undefined
  return String(m.conversation ?? estendida?.text ?? imagem?.caption ?? '')
}

/*
  As mensagens longas são montadas com array + join, e não com "\n" solto
  dentro de string. O texto tem acento, asterisco e emoji, e passa por várias
  camadas até chegar ao arquivo; escrever a quebra de linha como caractere
  literal já quebrou o boot uma vez.
*/
const RECUSA = [
  '❌ Esse código não confere ou já expirou.',
  '',
  'Peça um novo no sistema, em *Configurações → Equipe*, e me mande aqui deste mesmo celular.',
].join('\n')

/**
 * Boas-vindas depois que o número é confirmado.
 *
 * Adaptada ao papel: oferecer lançamento de despesa a quem não tem acesso ao
 * financeiro seria prometer o que a pessoa vai levar recusa ao tentar.
 */
async function boasVindas(userId: string, harasId: string): Promise<string> {
  const [{ data: haras }, { data: membro }] = await Promise.all([
    supabase.from('haras').select('nome').eq('id', harasId).maybeSingle(),
    supabase.from('membros').select('papel').eq('user_id', userId).maybeSingle(),
  ])

  const nomeHaras = haras?.nome ?? 'seu haras'
  const veFinanceiro = membro?.papel === 'dono' || membro?.papel === 'gerente'

  const lancar = [
    '• _"Vacinei a Estrela contra influenza hoje"_',
    '• _"A Brisa pesou 420 quilos"_',
    '• _"Cobri a Aurora com o Imperador ontem"_',
  ]
  if (veFinanceiro) {
    lancar.unshift('• _"Gastei 1.200 de ração, divide entre os nove"_')
  }

  const perguntar = [
    '• _"Quais éguas estão prenhas?"_',
    '• _"Quando vence a vacina da Aurora?"_',
    '• _"Quem está no piquete 2?"_',
  ]
  if (veFinanceiro) {
    perguntar.push('• _"Quanto já gastei com vacina na Brilhante?"_')
  }

  return [
    `✅ Número confirmado. Bem-vindo ao *HarasPro*, ${nomeHaras}!`,
    '',
    'Sou o assistente do haras. Pode falar comigo por *áudio ou texto*, do jeito que for mais fácil — inclusive com a mão suja, no meio do curral.',
    '',
    '*📝 Para eu registrar:*',
    ...lancar,
    '',
    '*🔎 Para eu consultar:*',
    ...perguntar,
    '',
    '⚠️ *Antes de gravar qualquer coisa eu confirmo com você.* Se faltar algum dado, eu pergunto — nunca invento.',
    '',
    '_Ainda estou sendo treinado para entender tudo isso. Por enquanto eu respondo, mas ainda não lanço. Aviso por aqui quando estiver pronto._',
  ].join('\n')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.searchParams.get('s') !== WEBHOOK_SEGREDO) {
    return new Response('não autorizado', { status: 401 })
  }

  const corpo = await req.json().catch(() => null)
  if (!corpo) return new Response('ok')

  const evento = String(corpo.event ?? '').toLowerCase()
  const instancia = String(corpo.instance ?? '')
  const dados = (corpo.data ?? {}) as Record<string, unknown>

  // ------------------------------------------------------ estado da conexão
  if (evento === 'connection.update') {
    const estado = String(dados.state ?? '')
    if (estado === 'open' || estado === 'close') {
      // Quem monta o nome da instância é o banco; quem desmonta também.
      const { data: harasId } = await supabase.rpc('haras_por_instancia', {
        p_instancia: instancia,
      })

      if (harasId) {
        const jid = String(dados.wuid ?? '')
        await supabase.rpc('registrar_conexao_whatsapp', {
          p_haras: harasId,
          p_numero: estado === 'open' && jid ? jid.split('@')[0] : null,
        })
      }
    }
    return new Response('ok')
  }

  // --------------------------------------------------- mensagem recebida
  if (evento !== 'messages.upsert') return new Response('ok')

  const chave = (dados.key ?? {}) as Record<string, unknown>
  const remetente = String(chave.remoteJid ?? '')

  // Próprias mensagens e grupos ficam de fora: eco viraria laço, e grupo não
  // identifica pessoa.
  if (chave.fromMe === true) return new Response('ok')
  if (remetente.endsWith('@g.us')) return new Response('ok')

  const numero = remetente.split('@')[0]
  const texto = textoDaMensagem(dados.message as Record<string, unknown>).trim()

  const { data: membros } = await supabase.rpc('membro_por_telefone', { p_numero: numero })
  const membro = Array.isArray(membros) ? membros[0] : null

  // ------------------------------------------------------------ confirmação
  const candidato = texto.match(PIN)?.[1]
  if (!membro && candidato) {
    const { data: verificado } = await supabase.rpc('verificar_telefone_por_pin', {
      p_numero: numero,
      p_pin: candidato,
    })
    const ok = Array.isArray(verificado) ? verificado[0] : null

    await enviar(instancia, numero, ok ? await boasVindas(ok.user_id, ok.haras_id) : RECUSA)
    return new Response('ok')
  }

  /*
    Número desconhecido e sem código: silêncio.

    Responder a qualquer um transformaria o número num alvo de spam e
    acumularia sinais de automação — que é justamente o que faz o WhatsApp
    banir um número não-oficial. Quem foi convidado sabe que precisa mandar o
    PIN; o resto não recebe nada.
  */
  if (!membro) return new Response('ok')

  // ---------------------------------------------------------- membro conhecido
  await responderMembro(instancia, numero, texto)
  return new Response('ok')
})

/**
 * Aqui entra o agente: transcrever o áudio, entender a intenção, CONFIRMAR
 * antes de gravar e cobrar o campo que faltou. Enquanto isso não existe, a
 * resposta diz a verdade em vez de fingir que entendeu.
 */
async function responderMembro(instancia: string, numero: string, texto: string) {
  await enviar(
    instancia,
    numero,
    texto
      ? 'Recebi sua mensagem. Ainda estou aprendendo a lançar no sistema — em breve vou entender áudio e texto e confirmar com você antes de gravar.'
      : 'Recebi seu áudio. Ainda estou aprendendo a transcrever — em breve.',
  )
}
