import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { formatBRL } from '@/lib/format'

/**
 * Quanto custa manter cada categoria do plantel.
 *
 * Pedido de Seu Hélio olhando o financeiro: "custo médio animal, categoria".
 * Não é categoria de despesa — essa já existia. É a do ANIMAL: quanto sai para
 * segurar as éguas, os potros, os garanhões. É o número que responde "o que eu
 * seguro e o que eu vendo".
 *
 * Some inteiro para quem não tem acesso ao financeiro: a função do banco
 * devolve vazio para esses papéis, e um quadro zerado seria pior que ausente —
 * pareceria que o haras não gastou nada.
 */
export function CustoPorCategoria() {
  const { data, loading, error } = useAsync(() => store.getCustoPorCategoria(), [])
  const linhas = data ?? []

  if (error || (!loading && linhas.length === 0)) return null

  const maior = Math.max(...linhas.map((l) => l.custoTotal), 1)

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold">Custo por categoria</h2>
      <p className="text-muted-foreground mb-3 text-xs">
        Veterinário e despesas rateadas somados, por cabeça.
      </p>

      {loading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        <ul className="space-y-3">
          {linhas.map((l) => (
            <li key={l.categoria}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {l.categoria}
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                    {l.animais} {l.animais === 1 ? 'animal' : 'animais'}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatBRL(l.custoMedio)}
                  <span className="text-muted-foreground text-xs font-normal"> /cabeça</span>
                </span>
              </div>
              <div className="bg-secondary mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${(l.custoTotal / maior) * 100}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {formatBRL(l.custoTotal)} no total
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
