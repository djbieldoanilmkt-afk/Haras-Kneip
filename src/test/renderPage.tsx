import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { TenantProvider } from '@/hooks/tenant'
import type { Haras, Papel } from '@/lib/database.types'

const HARAS_PADRAO: Haras = {
  id: 'h1',
  nome: 'Haras Kneip',
  slug: 'haras-kneip',
  logo_url: null,
  status_conta: 'ativa',
  trial_expira_em: '2099-01-01T00:00:00Z',
  plano: 'haras',
  created_at: '2026-01-01T00:00:00Z',
}

/**
 * Renderiza uma página dentro de um router, com a rota que ela espera.
 *
 * O tenant vem embutido porque as telas protegidas leem `papel` para decidir
 * o que oferecer — sem ele, `useTenant` lança. `papel` é sobrescrevível para
 * testar o que o peão vê e o que não vê.
 */
export function renderPage(
  element: ReactElement,
  { path = '/', route = '/', papel = 'dono' as Papel, haras = HARAS_PADRAO } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TenantProvider value={{ haras, papel, recarregar: () => {} }}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </TenantProvider>
    </MemoryRouter>,
  )
}
