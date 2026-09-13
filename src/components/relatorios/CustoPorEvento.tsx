import { Trophy } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { formatBRL, formatDate } from '@/lib/format'

/**
 * Quanto custou cada evento.
 *
 * Pedido de Seu Hélio: "cria o evento, Copa de Março. Aí eu tenho quanto
 * gastei no evento — carreto, alimentação, inscrição." É a conta que decide se
 * vale voltar no ano que vem, e hoje ela não existia em lugar nenhum.
 *
 * A quebra por categoria vem junto porque ele pediu as duas coisas na mesma
 * frase: "quanto gastei no evento E [em] alimentação".
 */
export function CustoPorEvento() {
  const { data, loading, error } = useAsync(() => store.getCustoPorEvento(), [])
  const eventos = data ?? []

  // Sem evento com despesa não há o que mostrar — e um quadro vazio ocuparia
  // espaço de relatório dizendo nada.
  if (error || (!loading && eventos.length === 0)) return null

  return (
    <Card className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4" />
        Custo por evento
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">
        Prova, copa e exposição com as despesas lançadas em cada uma.
      </p>

      {loading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <ul className="divide-border divide-y">
          {eventos.map((e) => (
            <li key={e.eventoId} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">{e.titulo}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatBRL(e.total)}
                </span>
              </div>

              <p className="text-muted-foreground text-xs">
                {formatDate(e.data)}
                {e.animais > 0 && (
                  <> · {e.animais} {e.animais === 1 ? 'animal' : 'animais'}</>
                )}
              </p>

              {e.porCategoria.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {e.porCategoria.map((c) => (
                    <li key={c.categoria} className="text-muted-foreground text-xs">
                      {c.categoria} <span className="tabular-nums">{formatBRL(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
