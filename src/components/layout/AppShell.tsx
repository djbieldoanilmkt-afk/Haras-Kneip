import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AppSidebar } from './AppSidebar'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from './CommandPalette'

export function AppShell() {
  const { open, setOpen } = useCommandPalette()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <Topbar onOpenSearch={() => setOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  )
}
