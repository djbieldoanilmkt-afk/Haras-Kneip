import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { TenantProvider } from '@/hooks/tenant'
import { useAsync } from '@/hooks/useAsync'
import { useSession } from '@/hooks/useSession'
import { supabase } from '@/lib/supabase'
import { contaPodeUsar } from '@/lib/conta'
import type { Haras } from '@/lib/database.types'

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

  const { data: haras, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase
      .from('membros')
      .select('haras:haras_id(*)')
      .maybeSingle()
    if (error) throw error
    return (data?.haras as unknown as Haras) ?? null
  }, [session?.user.id])

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
    <TenantProvider value={{ haras, recarregar: reload }}>
      <Outlet />
    </TenantProvider>
  )
}
