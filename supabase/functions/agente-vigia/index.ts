import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * O vigia do agente.
 *
 * Roda de hora em hora, pelo agendador do banco. Pergunta à Evolution se o
 * WhatsApp continua conectado e à OpenRouter quanto crédito sobrou, e grava o
 * resultado — que a tela lê e mostra.
 *
 * POR QUE ISTO EXISTE: o agente quebra em silêncio. Crédito acaba, a sessão do
 * WhatsApp cai, o servidor sai do ar — e em nenhum desses casos alguém é
 * avisado. O primeiro a perceber é o cliente, tentando lançar uma vacina de
 * dentro do curral e não recebendo resposta.
 *
 * AVISO POR WHATSAPP, COM CUIDADO: só para o que NÃO derruba o WhatsApp
 * (crédito acabando). Avisar "seu WhatsApp caiu" por WhatsApp não chegaria a
 * lugar nenhum; esse caso fica para a tela.
 */

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')!
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_KEY')!
const RESUMO_SEGREDO = Deno.env.get('RESUMO_SEGREDO')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

/** Abaixo disto o agente tem semanas, não meses. Avisa enquanto dá tempo. */
const CREDITO_BAIXO = 2

/** Sobra na OpenRouter, em dólares. Nulo quando não deu para consultar. */
async function creditoRestante(): Promise<number | null> {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    })
    if (!r.ok) return null
    const d = (await r.json()) as { data?: { total_credits?: number; total_usage?: number } }
    const total = Number(d.data?.total_credits ?? 0)
    const usado = Number(d.data?.total_usage ?? 0)
    return Number((total - usado).toFixed(4))
  } catch {
    return null
  }
}

/** Estado da sessão de WhatsApp daquela instância. */
async function estadoDoWhatsapp(instancia: string): Promise<string> {
  try {
    const r = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instancia}`, {
      headers: { apikey: EVOLUTION_KEY },
    })
    if (!r.ok) return 'erro'
    const d = (await r.json()) as { instance?: { state?: string } }
    return String(d.instance?.state ?? 'desconhecido')
  } catch {
    // Servidor fora do ar responde igual a instância morta, do ponto de vista
    // de quem usa: o agente não atende.
    return 'erro'
  }
}

async function avisar(instancia: string, numero: string, texto: string) {
  await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: numero.replace(/\D/g, ''), text: texto }),
  }).catch(() => {})
}

Deno.serve(async (req) => {
  if (req.headers.get('x-segredo') !== RESUMO_SEGREDO) {
    return new Response('nao autorizado', { status: 401 })
  }

  const { data, error } = await supabase.rpc('haras_para_vigiar')
  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 })
  }

  // Uma consulta de crédito só: a conta da OpenRouter é do produto inteiro,
  // não de cada haras.
  const credito = await creditoRestante()
  const linhas = (data ?? []) as { haras_id: string; instancia: string; telefone_dono: string | null }[]
  const relatorio: Record<string, string> = {}

  for (const l of linhas) {
    const estado = await estadoDoWhatsapp(l.instancia)
    relatorio[l.instancia] = estado

    await supabase.rpc('registrar_saude_agente', {
      p_haras: l.haras_id,
      p_whatsapp_estado: estado,
      p_credito: credito,
      p_erro: null,
    })

    /*
      Aviso por WhatsApp só faz sentido com o WhatsApp de pé — e só para o
      dono, que é quem pode pôr crédito.
    */
    if (estado === 'open' && credito !== null && credito <= CREDITO_BAIXO && l.telefone_dono) {
      await avisar(
        l.instancia,
        l.telefone_dono,
        [
          '⚠️ *Aviso do HarasPro*',
          '',
          `O crédito da inteligência artificial está em US$ ${credito.toFixed(2)}.`,
          '',
          'Quando acabar, eu paro de entender as mensagens — os lançamentos por áudio e texto deixam de funcionar até o crédito ser reposto.',
        ].join('\n'),
      )
    }
  }

  return new Response(JSON.stringify({ verificados: linhas.length, credito, relatorio }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
