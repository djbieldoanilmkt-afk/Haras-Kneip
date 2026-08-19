import { createContext, useContext, type ReactNode } from 'react'

import type { Haras } from '@/lib/database.types'

export type Tenant = {
  haras: Haras
  recarregar: () => void
}

const TenantContext = createContext<Tenant | null>(null)

export function TenantProvider({ value, children }: { value: Tenant; children: ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

/**
 * Haras da conta logada. Só existe dentro das rotas protegidas — a vitrine
 * pública e as telas de autenticação não têm tenant.
 */
export function useTenant(): Tenant {
  const tenant = useContext(TenantContext)
  if (!tenant) {
    throw new Error('useTenant só pode ser usado dentro das rotas protegidas.')
  }
  return tenant
}
