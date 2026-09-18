import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SEM_LOCAL, agruparPorLocal } from '@/lib/plantel'
import { cn } from '@/lib/utils'
import type { Animal } from '@/lib/database.types'

export function OcupacaoPiquetes({
  animais,
  carregando,
}: {
  animais: Animal[]
  carregando: boolean
}) {
  const lotes = agruparPorLocal(animais)
  const comLocal = lotes.filter((l) => l.local !== SEM_LOCAL)

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4" />
          Ocupação
        </h2>
        {!carregando && comLocal.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {comLocal.length} {comLocal.length > 1 ? 'locais' : 'local'}
          </span>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : lotes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Nenhum animal cadastrado.</p>
      ) : (
        <ul className="space-y-3">
          {lotes.map((lote) => (
            <li key={lote.local}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'truncate text-sm font-medium',
                    lote.local === SEM_LOCAL && 'text-muted-foreground italic',
                  )}
                >
                  {lote.local}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {lote.animais.length}
                </span>
              </div>

              {/* Os nomes, e não só a contagem: saber que o Piquete 2 tem
                  quatro animais serve pouco; saber quais são é o que resolve
                  a conferência da manhã. */}
              <div className="flex flex-wrap gap-1">
                {lote.animais.map((a) => (
                  <Link
                    key={a.id}
                    to={`/animal/${a.id}`}
                    className="bg-secondary hover:bg-accent hover:text-accent-foreground max-w-full truncate rounded-full px-2 py-0.5 text-xs transition-colors"
                  >
                    {a.nome}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
