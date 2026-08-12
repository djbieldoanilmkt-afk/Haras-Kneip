import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Páginas carregadas sob demanda.
 *
 * Sem isso o bundle fica em um pedaço só de ~1,2 MB, e quem abre apenas a
 * vitrine pública baixa também todo o sistema administrativo, incluindo os
 * gráficos e o assistente de voz.
 */
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Catalogo = lazy(() => import('@/pages/Catalogo'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const AnimalForm = lazy(() => import('@/pages/AnimalForm'))
const Calendario = lazy(() => import('@/pages/Calendario'))
const Relatorios = lazy(() => import('@/pages/Relatorios'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const PlantelPublico = lazy(() => import('@/pages/PlantelPublico'))

function Carregando() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}

/**
 * Rotas em modo hash, idênticas às do js/router.js legado. Manter o hash
 * preserva os links já compartilhados (#/plantel, #/animal/:id) e dispensa
 * regra de rewrite no servidor que publica o site.
 */
export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Carregando />}>
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
      </Suspense>

      <Toaster position="bottom-right" />
    </HashRouter>
  )
}
