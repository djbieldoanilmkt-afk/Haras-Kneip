import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

/**
 * Sessão do Supabase Auth, reativa a login/logout em qualquer aba.
 * `carregando` distingue "ainda não sei" de "não logado" — sem isso a guarda
 * de rota expulsaria o usuário logado durante a primeira pintura.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      setCarregando(false)
    })

    return () => assinatura.subscription.unsubscribe()
  }, [])

  return { session, carregando }
}
