import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { TenantProvider, useTenant, veFinanceiro } from '@/hooks/tenant'
import { useAsync } from '@/hooks/useAsync'
import { useSession } from '@/hooks/useSession'
import { supabase } from '@/lib/supabase'
import { contaPodeUsar } from '@/lib/conta'
import type { Haras, Papel } from '@/lib/database.types'

function TelaCarregando() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </div>
  )
}

/** Exige sessão. Sem login, manda para /entrar. */
export function RequireSession() {
  const { session, carregando } = useSession()

  if (carregando) return <TelaCarregando />
  if (!session) return <Navigate to="/entrar" replace />
  return <Outlet />
}

/**
 * Exige vínculo com um haras e conta utilizável.
 * Sem haras → onboarding. Trial vencido ou conta bloqueada → /assinar
 * (que fica dentro desta guarda, pois precisa do tenant para se exibir).
 */
export function RequireHaras() {
  const { session } = useSession()
  const location = useLocation()

  // Papel vem junto do haras: e a mesma linha de `membros`, e evita uma
  // segunda ida ao banco em toda tela que precisa saber o que oferecer.
  const { data: vinculo, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase
      .from('membros')
      .select('papel, haras:haras_id(*)')
      .maybeSingle()
    if (error) throw error
    if (!data?.haras) return null
    return {
      haras: data.haras as unknown as Haras,
      papel: (data.papel as Papel) ?? 'peao',
    }
  }, [session?.user.id])

  const haras = vinculo?.haras ?? null

  if (loading) return <TelaCarregando />

  if (error) {
    return (
      <div className="text-muted-foreground grid min-h-screen place-items-center p-6 text-sm">
        Não foi possível carregar sua conta: {error.message}
      </div>
    )
  }

  if (!haras) return <Navigate to="/criar-haras" replace />

  if (!contaPodeUsar(haras) && location.pathname !== '/assinar') {
    return <Navigate to="/assinar" replace />
  }

  return (
    <TenantProvider value={{ haras, papel: vinculo?.papel ?? 'peao', recarregar: reload }}>
      <Outlet />
    </TenantProvider>
  )
}

/**
 * Rotas do livro financeiro.
 *
 * O menu já esconde o item, mas quem digitar a URL chegaria numa tela que
 * carrega vazia — o RLS devolve zero despesas para o peão. Melhor devolver ao
 * painel do que mostrar um financeiro que parece zerado.
 */
export function RequireFinanceiro() {
  const { papel } = useTenant()
  if (!veFinanceiro(papel)) return <Navigate to="/painel" replace />
  return <Outlet />
}
