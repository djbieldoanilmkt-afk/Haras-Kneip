import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'

/**
 * Aviso de que o assistente parou.
 *
 * O agente quebra em silêncio: o crédito acaba, a sessão do WhatsApp cai, o
 * servidor sai do ar — e ele simplesmente deixa de responder. Sem este aviso,
 * quem descobre é o peão no curral, mandando áudio para o vazio.
 *
 * Fica no app, e não só no WhatsApp, porque a falha mais comum DERRUBA o
 * WhatsApp: avisar por lá não chegaria. O aviso por mensagem cobre o outro
 * caso (crédito acabando), e os dois juntos fecham.
 *
 * Some quando está tudo bem. Faixa permanente de "tudo certo" vira paisagem, e
 * aí ninguém enxerga a que importa.
 */
export function AvisoAgente() {
  const { data } = useAsync(() => store.getSaudeDoAgente(), [])

  // Ainda carregando, ou o vigia nunca passou: silêncio é melhor que alarme
  // falso. E quem nunca conectou o agente não precisa ser cobrado por isso
  // em toda tela.
  if (!data || data.saudavel || data.motivo === 'nunca_conectado') return null

  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-center text-sm"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        <strong>O assistente do WhatsApp está fora do ar.</strong> {data.detalhe}
      </span>
      <Link to="/configuracoes" className="font-semibold underline underline-offset-2">
        Resolver
      </Link>
    </div>
  )
}
