import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Baby,
  BookOpen,
  Calendar,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

import { Brand } from './Brand'
import { useTenant, veFinanceiro } from '@/hooks/tenant'
import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/catalogo', label: 'Plantel', icon: BookOpen },
  { to: '/reproducao', label: 'Reprodução', icon: Baby },
  { to: '/sanidade', label: 'Sanidade', icon: ShieldCheck },
  // `financeiro: true` some do menu para quem não tem acesso ao livro. Esconder
  // é só conveniência: quem recusa de verdade é o RLS.
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, financeiro: true },
  { to: '/calendario', label: 'Calendário', icon: Calendar },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { haras, papel } = useTenant()
  const itens = NAV.filter((i) => !i.financeiro || veFinanceiro(papel))

  return (
    <aside className="bg-card border-border flex h-full w-60 shrink-0 flex-col border-r">
      <div className="px-4 py-5">
        <Brand nome={haras.nome} logoUrl={haras.logo_url} />
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Menu principal">
        {itens.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
        {PRODUTO.nome}
      </div>
    </aside>
  )
}
