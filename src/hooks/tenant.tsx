import { createContext, useContext, type ReactNode } from 'react'

import type { Haras, Papel } from '@/lib/database.types'

export type Tenant = {
  haras: Haras
  /** Papel de quem está logado NESTE haras. Decide o que a tela oferece. */
  papel: Papel
  recarregar: () => void
}

/**
 * Quem enxerga dinheiro. Espelha ve_financeiro() em 009.
 *
 * A tela esconder é conveniência; quem recusa de verdade é o RLS. Se fosse só
 * aqui, bastaria chamar a API direto para ler as despesas.
 */
export function veFinanceiro(papel: Papel): boolean {
  return papel === 'dono' || papel === 'gerente'
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
