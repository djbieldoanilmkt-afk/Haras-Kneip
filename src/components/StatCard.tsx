import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { cn } from '@/lib/utils'

/**
 * A contagem só se aplica a número. Texto — como a idade média, "7.2" — é
 * exibido direto. Fica em componente próprio porque hooks não podem ser
 * chamados dentro de condicional: aqui o hook roda sempre e a condição decide
 * apenas o que aparece.
 */
function Valor({ value }: { value: number | string }) {
  const contado = useContadorAnimado(typeof value === 'number' ? value : 0)
  return <>{typeof value === 'number' ? contado : value}</>
}

export function StatCard({
  value,
  label,
  highlight,
}: {
  value: number | string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-lg border p-4 shadow-sm">
      {highlight && <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />}
      <div
        className={cn(
          'numero-animado text-2xl font-bold tracking-tight',
          highlight && 'text-primary',
        )}
      >
        <Valor value={value} />
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11px] tracking-wider uppercase">
        {label}
      </div>
    </div>
  )
}
