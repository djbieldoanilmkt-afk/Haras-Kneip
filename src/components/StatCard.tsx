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

/**
 * `alerta` existe para os cartões que contam problema — pendência vencida,
 * parto atrasado. Sem ele o número fica com o mesmo peso visual de um dado
 * neutro, e o painel deixa de dizer o que precisa de atenção primeiro.
 */
export type Tom = 'neutro' | 'marca' | 'alerta'

const FAIXA: Record<Tom, string> = {
  neutro: '',
  marca: 'bg-primary',
  alerta: 'bg-destructive',
}

const NUMERO: Record<Tom, string> = {
  neutro: '',
  marca: 'text-primary',
  alerta: 'text-destructive',
}

export function StatCard({
  value,
  label,
  tom = 'neutro',
  detalhe,
}: {
  value: number | string
  label: string
  tom?: Tom
  /** Linha curta abaixo do rótulo, para qualificar o número. */
  detalhe?: string
}) {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-lg border p-4 shadow-sm">
      {tom !== 'neutro' && (
        <span className={cn('absolute inset-y-0 left-0 w-0.5', FAIXA[tom])} />
      )}
      <div
        className={cn(
          'numero-animado font-heading text-3xl font-extrabold tracking-tight',
          NUMERO[tom],
        )}
      >
        <Valor value={value} />
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11px] tracking-wider uppercase">
        {label}
      </div>
      {detalhe && <div className="text-muted-foreground mt-0.5 text-xs">{detalhe}</div>}
    </div>
  )
}
