import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

import { observarConexao } from '@/lib/offline'

/**
 * Faixa de "sem conexão".
 *
 * Sem ela, o app offline é pior que o app quebrado: mostra o plantel de
 * ontem com cara de plantel de hoje, e quem confere uma vacina acredita. A
 * faixa não conserta o dado — deixa claro que ele pode estar velho, e diz
 * qual caminho continua funcionando.
 */
export function AvisoOffline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => observarConexao(setOnline), [])

  if (online) return null

  return (
    <div
      role="status"
      className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>
        <strong>Sem conexão.</strong> Você está vendo os últimos dados carregados. Para lançar
        agora, fale com o assistente no WhatsApp.
      </span>
    </div>
  )
}
