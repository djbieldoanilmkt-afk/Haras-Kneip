/*
  Import por npm:, e SEM a linha de tipos `jsr:@supabase/functions-js`.

  Testado neste projeto, uma dependencia por vez: o import de tipos por jsr:
  sozinho derruba o boot (BOOT_ERROR, a funcao nem sobe), e esm.sh tambem
  falha. Só npm: resolve. A linha de tipos serve ao editor e nao faz falta
  em execucao.
*/
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Conexão do WhatsApp do haras com a Evolution API.
 *
 * Existe como Edge Function, e não como chamada do navegador, por um motivo
 * só: a chave da Evolution é global — quem a tem controla TODAS as instâncias
 * do servidor, de todos os haras. No bundle do front ela seria pública, então
 * ela mora aqui e o navegador nunca a vê.
 *
 * Ações (POST { acao }):
 *   conectar    -> cria a instância se não existir e devolve o QR
 *   estado      -> devolve o estado da conexão e o número conectado
 *   desconectar -> derruba a sessão (o número deixa de responder)
 */

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
/** Sufixo secreto na URL do webhook: sem ele, qualquer um postaria mensagens. */
const WEBHOOK_SEGREDO = Deno.env.get('WEBHOOK_SEGREDO') ?? ''

/*
  Lista fixa NAO serve aqui.

  O supabase-js manda `x-client-info` e `apikey` alem de authorization e
  content-type. Permitindo so os dois primeiros, o navegador recusa o
  preflight e o fetch estoura antes de sair da maquina — o erro que aparece na
  tela e "Failed to send a request to the Edge Function", que nao diz nada
  sobre CORS. Devolver de volta o que o navegador pediu resolve hoje e nao
  quebra quando a biblioteca acrescentar outro cabecalho.
*/
function cors(req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ??
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function resposta(req: Request, corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  })
}

/** Chamada à Evolution. Devolve o corpo já decodificado. */
async function evolution(caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${EVOLUTION_URL}${caminho}`, {
    ...init,
    headers: {
      apikey: EVOLUTION_KEY!,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const texto = await resposta.text()
  let corpo: unknown = texto
  try {
    corpo = JSON.parse(texto)
  } catch {
    // A Evolution devolve texto puro em alguns erros; mantém o cru.
  }
  return { ok: resposta.ok, status: resposta.status, corpo }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })

  const json = (corpo: unknown, status = 200) => resposta(req, corpo, status)

  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    // Mensagem explícita em vez de erro genérico: enquanto o servidor da
    // Evolution não existir, é isto que a tela deve dizer.
    return json({ erro: 'A Evolution API ainda não está configurada neste projeto.' }, 503)
  }

  const autorizacao = req.headers.get('Authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Quem está chamando. O token vem do navegador; a validação é aqui.
  const { data: usuario, error: erroUsuario } = await supabase.auth.getUser(
    autorizacao.replace('Bearer ', ''),
  )
  if (erroUsuario || !usuario.user) return json({ erro: 'Sessão inválida.' }, 401)

  // Conectar o WhatsApp é ato de dono: a sessão vale para o haras inteiro.
  const { data: membro } = await supabase
    .from('membros')
    .select('haras_id, papel')
    .eq('user_id', usuario.user.id)
    .maybeSingle()

  if (!membro) return json({ erro: 'Usuário sem haras.' }, 403)
  if (membro.papel !== 'dono') {
    return json({ erro: 'Só o dono da conta conecta o WhatsApp.' }, 403)
  }

  const { data: instancia } = await supabase.rpc('instancia_whatsapp', {
    p_haras: membro.haras_id,
  })

  const { acao } = await req.json().catch(() => ({ acao: 'estado' }))

  if (acao === 'desconectar') {
    await evolution(`/instance/logout/${instancia}`, { method: 'DELETE' })
    await supabase.rpc('registrar_conexao_whatsapp', {
      p_haras: membro.haras_id,
      p_numero: null,
    })
    return json({ estado: 'close' })
  }

  if (acao === 'conectar') {
    const criacao = await evolution('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instancia,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        // A Evolution entrega as mensagens recebidas aqui. O segredo vai na
        // URL porque ela não assina o corpo do webhook.
        webhook: {
          url: `${SUPABASE_URL}/functions/v1/whatsapp-webhook?s=${WEBHOOK_SEGREDO}`,
          byEvents: false,
          base64: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    })

    /*
      Falha na criação NÃO interrompe, de propósito. Dois casos normais caem
      aqui: a instância já existe (reconexão depois que a sessão caiu), e a
      chave configurada é o token da própria instância, que por ser escopado
      não tem permissão de criar. Quem decide é /instance/connect logo abaixo:
      se ele responder, está tudo certo.
    */
    void criacao.ok

    const conexao = await evolution(`/instance/connect/${instancia}`)
    if (!conexao.ok) {
      return json(
        { erro: 'A Evolution não devolveu o QR.', detalhe: conexao.corpo, criacao: criacao.corpo },
        502,
      )
    }
    const c = conexao.corpo as Record<string, unknown>
    const criado = criacao.corpo as Record<string, unknown>

    // O QR aparece em lugares diferentes conforme a versão e conforme a
    // instância ser nova ou já existente.
    const qr =
      (c?.base64 as string) ??
      ((c?.qrcode as Record<string, unknown>)?.base64 as string) ??
      ((criado?.qrcode as Record<string, unknown>)?.base64 as string) ??
      null

    return json({ estado: 'connecting', qr, instancia })
  }

  // estado
  const estado = await evolution(`/instance/connectionState/${instancia}`)
  const e = estado.corpo as Record<string, unknown>
  const situacao =
    ((e?.instance as Record<string, unknown>)?.state as string) ?? (e?.state as string) ?? 'close'

  /*
    Descobrir QUAL número atendeu ao QR só é possível depois que a sessão
    abre — quem escaneia é a pessoa, e o servidor é que conta. Por isso o
    número é gravado aqui, na primeira consulta de estado após conectar, e
    não pedido num campo na tela.
  */
  let numero: string | null = null
  if (situacao === 'open') {
    const lista = await evolution(`/instance/fetchInstances?instanceName=${instancia}`)
    const itens = Array.isArray(lista.corpo) ? lista.corpo : [lista.corpo]
    const jid = (itens[0] as Record<string, unknown>)?.ownerJid as string | undefined
    numero = jid ? jid.split('@')[0] : null

    if (numero) {
      await supabase.rpc('registrar_conexao_whatsapp', {
        p_haras: membro.haras_id,
        p_numero: numero,
      })
    }
  }

  return json({ estado: situacao, instancia, numero })
})
