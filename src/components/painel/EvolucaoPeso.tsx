import { Link } from 'react-router-dom'
import { Scale, TrendingDown, TrendingUp } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { diasAte, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Animal } from '@/lib/database.types'
import type { PesagemResumo } from '@/lib/store'

/** Acima disto o animal já passou tempo demais sem ir à balança. */
const DIAS_ATRASO = 90

export function EvolucaoPeso({
  pesagens,
  animais,
  carregando,
}: {
  pesagens: PesagemResumo[]
  animais: Animal[]
  carregando: boolean
}) {
  const comPesagem = new Set(pesagens.map((p) => p.animal_id))
  const nuncaPesados = animais.filter((a) => !comPesagem.has(a.id))
  const atrasados = pesagens.filter((p) => -diasAte(p.data_pesagem) > DIAS_ATRASO).length

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4" />
          Pesagens
        </h2>
        {!carregando && atrasados + nuncaPesados.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {atrasados + nuncaPesados.length} sem pesar há mais de {DIAS_ATRASO} dias
          </span>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : pesagens.length === 0 && nuncaPesados.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhum animal cadastrado.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {pesagens.slice(0, 6).map((p) => {
            const dias = -diasAte(p.data_pesagem)
            const atrasado = dias > DIAS_ATRASO
            const subiu = (p.variacao ?? 0) > 0

            return (
              <li key={p.animal_id}>
                <Link
                  to={`/animal/${p.animal_id}`}
                  className="hover:bg-secondary -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.animal}</p>
                    <p
                      className={cn(
                        'truncate text-xs',
                        atrasado ? 'text-status-prenha font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(p.data_pesagem)} · há {dias} dias
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">{p.peso} kg</p>
                    {p.variacao === null ? (
                      <p className="text-muted-foreground text-xs">primeira</p>
                    ) : (
                      <p
                        className={cn(
                          'flex items-center justify-end gap-0.5 text-xs tabular-nums',
                          subiu ? 'text-primary' : 'text-destructive',
                        )}
                      >
                        {subiu ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {subiu ? '+' : ''}
                        {p.variacao.toFixed(1)} kg
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}

          {/* Animal que nunca foi à balança não tem linha na tabela de
              pesagens, então some de qualquer consulta feita só por ela — e é
              justamente o caso mais grave. Entra aqui pela lista do plantel. */}
          {nuncaPesados.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                to={`/animal/${a.id}`}
                className="hover:bg-secondary -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.nome}</p>
                  <p className="text-destructive truncate text-xs font-medium">Nunca pesado</p>
                </div>
                <span className="text-muted-foreground shrink-0 text-sm">—</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
