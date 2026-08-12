import { NavLink } from 'react-router-dom'
import { BarChart3, BookOpen, Calendar, LayoutDashboard, Settings } from 'lucide-react'

import { Brand } from './Brand'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Plantel', icon: BookOpen, end: false },
  { to: '/calendario', label: 'Calendário', icon: Calendar, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="bg-card border-border flex h-full w-60 shrink-0 flex-col border-r">
      <div className="px-4 py-5">
        <Brand />
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Menu principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'text-muted-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-secondary hover:text-foreground',
                isActive && 'bg-accent text-accent-foreground font-semibold',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-border text-muted-foreground border-t px-4 py-3 text-xs">
        Mangalarga Marchador
      </div>
    </aside>
  )
}
