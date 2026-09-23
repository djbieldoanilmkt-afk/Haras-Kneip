import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * O agente falando primeiro.
 *
 * Chamada uma vez por dia pelo agendador do banco (pg_cron + pg_net). Lê o que
 * cada pessoa precisa saber hoje e manda pelo WhatsApp.
 *
 * Autenticação por cabeçalho, não por query string: segredo em URL aparece nos
 * logs de acesso. Máquina para máquina, sem sessão de navegador para validar,
 * então `verify_jwt` fica desligado e a checagem é essa aqui.
 *
 * Só recebe quem tem número CONFIRMADO. Mandar mensagem para número não
 * provado é o caminho mais curto para o banimento de um número não-oficial —
 * e seria mandar aviso do haras para o celular de um desconhecido.
 */

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')!
// Segredo próprio, não o do webhook de entrada: aquele viaja na URL que a
// Evolution chama, e rotacioná-lo exigiria re-registrar o webhook lá.
const RESUMO_SEGREDO = Deno.env.get('RESUMO_SEGREDO')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

type Linha = { instancia: string; telefone: string; mensagem: string }

Deno.serve(async (req) => {
  if (req.headers.get('x-segredo') !== RESUMO_SEGREDO) {
    return new Response('nao autorizado', { status: 401 })
  }

  const { data, error } = await supabase.rpc('resumo_diario')
  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 })
  }

  const linhas = (data ?? []) as Linha[]
  const entregues: string[] = []

  for (const l of linhas) {
    if (!l.mensagem || !l.instancia) continue

    // O "+" do E.164 sai: a Evolution espera só dígitos no destinatário.
    const numero = l.telefone.replace(/\D/g, '')

    const r = await fetch(`${EVOLUTION_URL}/message/sendText/${l.instancia}`, {
      method: 'POST',
      headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: numero, text: l.mensagem }),
    }).catch(() => null)

    if (r?.ok) entregues.push(l.telefone)
  }

  // Marca só quem a Evolution aceitou. Se o WhatsApp estiver fora do ar,
  // ninguém fica marcado e a próxima passada tenta de novo.
  if (entregues.length) {
    await supabase.rpc('marcar_resumo_enviado', { p_telefones: entregues })
  }

  return new Response(
    JSON.stringify({ candidatos: linhas.length, enviados: entregues.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
