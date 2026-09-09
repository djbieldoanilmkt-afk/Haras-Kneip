import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { RequireHaras, RequireSession } from '@/components/auth/guards'
import { supabase } from '@/lib/supabase'

const Landing = lazy(() => import('@/pages/Landing'))
const Privacidade = lazy(() => import('@/pages/legal/Privacidade'))
const Termos = lazy(() => import('@/pages/legal/Termos'))
const Entrar = lazy(() => import('@/pages/auth/Entrar'))
const CriarConta = lazy(() => import('@/pages/auth/CriarConta'))
const RecuperarSenha = lazy(() => import('@/pages/auth/RecuperarSenha'))
const NovaSenha = lazy(() => import('@/pages/auth/NovaSenha'))
const CriarHaras = lazy(() => import('@/pages/auth/CriarHaras'))
const Assinar = lazy(() => import('@/pages/auth/Assinar'))

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Catalogo = lazy(() => import('@/pages/Catalogo'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const AnimalForm = lazy(() => import('@/pages/AnimalForm'))
const Calendario = lazy(() => import('@/pages/Calendario'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const Relatorios = lazy(() => import('@/pages/Relatorios'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const PlantelPublico = lazy(() => import('@/pages/PlantelPublico'))

function Carregando() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}

/**
 * O link de recuperação de senha entra pelo evento do Auth, não por rota —
 * o Supabase devolve o usuário com uma sessão temporária e cabe ao app
 * levá-lo à tela de nova senha.
 */
function RedirecionarRecuperacao() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        window.location.hash = '#/nova-senha'
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <RedirecionarRecuperacao />
      <Suspense fallback={<Carregando />}>
        <Routes>
          {/* público */}
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/criar-conta" element={<CriarConta />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/plantel/:slug" element={<PlantelPublico />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          {/* links antigos do Kneip compartilhados no WhatsApp continuam valendo */}
          <Route path="/plantel" element={<Navigate to="/plantel/haras-kneip" replace />} />

          {/* exige login */}
          <Route element={<RequireSession />}>
            <Route path="/nova-senha" element={<NovaSenha />} />
            <Route path="/criar-haras" element={<CriarHaras />} />

            {/* exige haras e conta utilizável */}
            <Route element={<RequireHaras />}>
              <Route path="/assinar" element={<Assinar />} />

              <Route element={<AppShell />}>
                <Route path="/painel" element={<Dashboard />} />
                <Route path="/catalogo" element={<Catalogo />} />
                <Route path="/animal/:id" element={<Perfil />} />
                <Route path="/novo-animal" element={<AnimalForm />} />
                <Route path="/editar-animal/:id" element={<AnimalForm />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
          </Route>

          <Route
            path="*"
            element={
              <p className="text-muted-foreground py-16 text-center">Página não encontrada.</p>
            }
          />
        </Routes>
      </Suspense>

      {/* Posicao e duracao vivem no proprio Toaster, junto do CSS que depende delas. */}
      <Toaster />
    </HashRouter>
  )
}
