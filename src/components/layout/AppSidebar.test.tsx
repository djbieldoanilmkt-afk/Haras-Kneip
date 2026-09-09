import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AppSidebar } from './AppSidebar'
import { TenantProvider } from '@/hooks/tenant'
import type { Haras } from '@/lib/database.types'

const HARAS: Haras = {
  id: 'h1',
  nome: 'Haras Kneip',
  slug: 'haras-kneip',
  logo_url: null,
  status_conta: 'ativa',
  trial_expira_em: '2099-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
}

function renderEm(path: string, haras: Haras = HARAS) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TenantProvider value={{ haras, recarregar: () => {} }}>
        <AppSidebar />
      </TenantProvider>
    </MemoryRouter>,
  )
}

describe('AppSidebar', () => {
  it('mostra os seis itens de navegacao', () => {
    renderEm('/painel')
    for (const rotulo of [
      'Painel',
      'Plantel',
      'Calendário',
      'Financeiro',
      'Relatórios',
      'Configurações',
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(rotulo) })).toBeInTheDocument()
    }
  })

  it('aponta o financeiro para /financeiro', () => {
    renderEm('/painel')
    expect(screen.getByRole('link', { name: /Financeiro/ })).toHaveAttribute('href', '/financeiro')
  })

  it('aponta o painel para /painel, nao para a raiz', () => {
    renderEm('/painel')
    expect(screen.getByRole('link', { name: /Painel/ })).toHaveAttribute('href', '/painel')
  })

  it('marca o item ativo com aria-current', () => {
    renderEm('/catalogo')
    expect(screen.getByRole('link', { name: /Plantel/ })).toHaveAttribute('aria-current', 'page')
  })

  it('mostra o nome do haras da conta, com monograma das iniciais', () => {
    renderEm('/painel', { ...HARAS, nome: 'Haras Santa Fé' })
    expect(screen.getByText('Haras Santa Fé')).toBeInTheDocument()
    expect(screen.getByText('HS')).toBeInTheDocument()
  })

  it('mostra a logo quando a conta tem uma', () => {
    renderEm('/painel', { ...HARAS, logo_url: 'https://exemplo/logo.png' })
    const img = document.querySelector('aside img')
    expect(img).toHaveAttribute('src', 'https://exemplo/logo.png')
  })
})
