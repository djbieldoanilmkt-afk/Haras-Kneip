import { cn } from '@/lib/utils'

/**
 * Marca do sistema: monograma HK em bloco sólido, nome em serifada.
 *
 * Substitui o emoji 🐴 que o app legado usava como logo. A serifada aparece
 * apenas aqui — no resto da interface tudo é Inter, o que transforma a marca
 * em assinatura em vez de ruído tipográfico.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="bg-primary text-primary-foreground font-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
        HK
      </div>
      <div className="font-brand text-sm leading-tight font-semibold">
        Haras
        <br />
        Kneip
      </div>
    </div>
  )
}
