import { cn } from '@/lib/utils'
import { statusClasses } from '@/lib/status'

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  if (!status) return null

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
        statusClasses(status),
        className,
      )}
    >
      {status}
    </span>
  )
}
