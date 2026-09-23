import { Link } from 'react-router-dom'
import { LogOut, Menu, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { limparDadosOffline } from '@/lib/offline'
import { ThemeToggle } from './ThemeToggle'

export function Topbar({
  onOpenSearch,
  onOpenMenu,
}: {
  onOpenSearch: () => void
  onOpenMenu: () => void
}) {
  return (
    <header className="border-border bg-card flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
      >
        <Menu className="size-4" />
      </Button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="border-border bg-background text-muted-foreground hover:bg-secondary flex h-9 flex-1 items-center gap-2 rounded-md border px-3 text-sm transition-colors md:max-w-xs"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Buscar animais...</span>
        <kbd className="border-border ml-auto hidden rounded border px-1.5 py-0.5 font-sans text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {/* nativeButton={false} porque o Base UI precisa saber que o elemento
            renderizado e uma ancora, nao um <button> nativo. */}
        <Button size="sm" nativeButton={false} render={<Link to="/novo-animal" />}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo animal</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sair da conta"
          onClick={async () => {
            // Apaga o cache offline ANTES de encerrar a sessão: num celular de
            // escritório, o próximo a entrar não pode ver o plantel do anterior.
            await limparDadosOffline()
            await supabase.auth.signOut()
          }}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
