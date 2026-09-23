import { Link } from 'react-router-dom'
import { ChevronRight, ShieldCheck } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { diasAte, formatDate, rotuloPrazo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PendenciaSanitaria } from '@/lib/store'

export type Faixa = 'vencido' | 'urgente' | 'proximo'

/**
 * Três faixas, e não duas: "vencido" e "vence amanhã" pedem ações diferentes
 * — uma é corrida atrás do prejuízo, a outra dá tempo de agendar o veterinário.
 */
export function faixaDoPrazo(dias: number): Faixa {
  if (dias < 0) return 'vencido'
  if (dias <= 7) return 'urgente'
  return 'proximo'
}

const PONTO: Record<Faixa, string> = {
  vencido: 'bg-destructive',
  urgente: 'bg-status-prenha',
  proximo: 'bg-status-vazia',
}

const TEXTO: Record<Faixa, string> = {
  vencido: 'text-destructive font-semibold',
  urgente: 'text-status-prenha font-medium',
  proximo: 'text-muted-foreground',
}

export function SemaforoSanitario({
  pendencias,
  carregando,
  limite = 6,
  titulo = 'Sanidade',
}: {
  pendencias: PendenciaSanitaria[]
  carregando: boolean
  /** No painel a lista e um resumo; na tela de Sanidade ela vai inteira. */
  limite?: number
  /**
   * Na tela de Sanidade o titulo da pagina ja e "Sanidade", e repetir a
   * palavra no cartao nao diz nada a quem esta lendo.
   */
  titulo?: string
}) {
  const vencidas = pendencias.filter((p) => diasAte(p.proxima_data) < 0).length

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" />
          {titulo}
        </h2>
        {!carregando && pendencias.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {vencidas > 0 && <span className="text-destructive font-semibold">{vencidas} vencida{vencidas > 1 ? 's' : ''}</span>}
            {vencidas > 0 && pendencias.length > vencidas && ' · '}
            {pendencias.length > vencidas && `${pendencias.length - vencidas} a vencer`}
          </span>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : pendencias.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhuma vacina, vermifugação ou exame vencendo nos próximos 30 dias.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {pendencias.slice(0, limite).map((p) => {
            const dias = diasAte(p.proxima_data)
            const faixa = faixaDoPrazo(dias)

            return (
              <li key={p.id}>
                <Link
                  to={`/animal/${p.animal_id}`}
                  className="hover:bg-secondary -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <span className={cn('size-2 shrink-0 rounded-full', PONTO[faixa])} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.animal}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.tipo}
                      {p.descricao ? ` · ${p.descricao}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">{formatDate(p.proxima_data)}</p>
                    <p className={cn('text-xs', TEXTO[faixa])}>{rotuloPrazo(dias)}</p>
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
