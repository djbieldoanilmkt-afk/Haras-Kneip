import { Clock } from 'lucide-react'

import { useTenant } from '@/hooks/tenant'
import { diasRestantesTrial } from '@/lib/conta'

/** Faixa discreta com os dias restantes do trial. Some em conta ativa. */
export function TrialBanner() {
  const { haras } = useTenant()

  if (haras.status_conta !== 'trial') return null
  const dias = diasRestantesTrial(haras)

  return (
    <div className="bg-status-prenha/10 text-status-prenha flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-medium">
      <Clock className="size-3.5" />
      {dias === 1 ? 'Último dia' : `${dias} dias restantes`} do período de teste.
    </div>
  )
}
