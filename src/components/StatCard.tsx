import { cn } from '@/lib/utils'

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
      <div className={cn('text-2xl font-bold tracking-tight', highlight && 'text-primary')}>
        {value}
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11px] tracking-wider uppercase">
        {label}
      </div>
    </div>
  )
}
