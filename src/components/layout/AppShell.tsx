import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AppSidebar } from './AppSidebar'
import { Topbar } from './Topbar'
import { TrialBanner } from './TrialBanner'
import { CommandPalette, useCommandPalette } from './CommandPalette'
import { useTenant } from '@/hooks/tenant'
import { PRODUTO } from '@/lib/produto'

export function AppShell() {
  const { pathname } = useLocation()
  const { haras } = useTenant()
  const { open, setOpen } = useCommandPalette()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.title = `${haras.nome} · ${PRODUTO.nome}`
  }, [haras.nome])

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Menu principal</SheetTitle>
          <AppSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        <Topbar onOpenSearch={() => setOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/*
            A key remonta este contêiner a cada rota, o que reinicia a animação
            CSS. Sem ela a entrada só rodaria na primeira carga da página.
          */}
          <div key={pathname} className="animar-entrada mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  )
}
