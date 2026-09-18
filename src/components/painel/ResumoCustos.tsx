import { Link } from 'react-router-dom'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'

import { CustoChart } from '@/components/charts/CustoChart'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ResumoCustos as Resumo } from '@/lib/store'

/**
 * Variação percentual contra o mês anterior.
 *
 * Sem base não existe percentual: quando o mês anterior foi zero, qualquer
 * gasto viraria divisão por zero (ou um "+∞%" sem sentido). Nesse caso a tela
 * mostra só o valor absoluto.
 */
function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

export function ResumoCustos({
  resumo,
  carregando,
}: {
  resumo: Resumo | null
  carregando: boolean
}) {
  const delta = resumo ? variacao(resumo.mesAtual, resumo.mesAnterior) : null
  const subiu = (delta ?? 0) > 0
  const topAnimais = resumo?.porAnimal.slice(0, 5) ?? []
  const maior = topAnimais[0]?.total ?? 0

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4" />
          Custos de sanidade
        </h2>
        {!carregando && delta !== null && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              subiu ? 'text-destructive' : 'text-primary',
            )}
          >
            {subiu ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {subiu ? '+' : ''}
            {delta.toFixed(0)}% vs. mês anterior
          </span>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <>
          <div className="animar-entrada mb-4">
            <CustoChart data={resumo?.porMes ?? []} />
          </div>

          {topAnimais.length > 0 && (
            <>
              <h3 className="text-muted-foreground mb-2 text-[11px] tracking-wider uppercase">
                Onde o dinheiro foi
              </h3>
              <ul className="space-y-1.5">
                {topAnimais.map((a) => (
                  <li key={a.animal_id}>
                    <Link
                      to={`/animal/${a.animal_id}`}
                      className="hover:bg-secondary -mx-2 block rounded-md px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm">{a.animal}</span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatBRL(a.total)}
                        </span>
                      </div>
                      {/* Barra proporcional ao maior gasto: compara de relance
                          sem precisar ler os números. */}
                      <div className="bg-secondary mt-1 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${maior > 0 ? (a.total / maior) * 100 : 0}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}
