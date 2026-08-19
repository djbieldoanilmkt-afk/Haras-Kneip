import { cn } from '@/lib/utils'
import { iniciais } from '@/components/AnimalCard'

/**
 * Marca do haras logado: logo enviada pela conta ou monograma com as
 * iniciais do nome. A serifada aparece apenas aqui — assinatura, não ruído.
 */
export function Brand({
  nome,
  logoUrl,
  className,
}: {
  nome: string
  logoUrl?: string | null
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="size-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="bg-primary text-primary-foreground font-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
          {iniciais(nome)}
        </div>
      )}
      <div className="font-brand truncate text-sm leading-tight font-semibold">{nome}</div>
    </div>
  )
}
