import { HashRouter, Route, Routes } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import Catalogo from '@/pages/Catalogo'
import Perfil from '@/pages/Perfil'
import AnimalForm from '@/pages/AnimalForm'
import Calendario from '@/pages/Calendario'
import Relatorios from '@/pages/Relatorios'
import Configuracoes from '@/pages/Configuracoes'
import PlantelPublico from '@/pages/PlantelPublico'

/**
 * Rotas em modo hash, idênticas às do js/router.js legado. Manter o hash
 * preserva os links já compartilhados (#/plantel, #/animal/:id) e dispensa
 * regra de rewrite no servidor que publica o site.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/plantel" element={<PlantelPublico />} />

        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/animal/:id" element={<Perfil />} />
          <Route path="/novo-animal" element={<AnimalForm />} />
          <Route path="/editar-animal/:id" element={<AnimalForm />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route
            path="*"
            element={
              <p className="text-muted-foreground py-16 text-center">Página não encontrada.</p>
            }
          />
        </Route>
      </Routes>

      <Toaster position="bottom-right" />
    </HashRouter>
  )
}
