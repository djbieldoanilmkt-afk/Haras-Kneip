import { Link } from 'react-router-dom'
import { ChevronRight, Baby } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { diasAte, formatDate, rotuloPrazo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PartoPrevisto } from '@/lib/store'

export function PartosPrevistos({
  partos,
  carregando,
}: {
  partos: PartoPrevisto[]
  carregando: boolean
}) {
  const atrasados = partos.filter((p) => diasAte(p.data_prevista_parto) < 0).length

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Baby className="size-4" />
          Partos previstos
        </h2>
        {!carregando && atrasados > 0 && (
          <span className="text-destructive text-xs font-semibold">
            {atrasados} passou da data
          </span>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : partos.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhum parto previsto para os próximos 90 dias.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {partos.slice(0, 6).map((p) => {
            const dias = diasAte(p.data_prevista_parto)

            return (
              <li key={p.id}>
                <Link
                  to={`/animal/${p.animal_id}`}
                  className="hover:bg-secondary -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.matriz}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.garanhao ? `Garanhão: ${p.garanhao}` : 'Garanhão não informado'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">{formatDate(p.data_prevista_parto)}</p>
                    <p
                      className={cn(
                        'text-xs',
                        dias < 0 && 'text-destructive font-semibold',
                        dias >= 0 && dias <= 15 && 'text-status-prenha font-medium',
                        dias > 15 && 'text-muted-foreground',
                      )}
                    >
                      {rotuloPrazo(dias)}
                    </p>
                  </div>

                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
