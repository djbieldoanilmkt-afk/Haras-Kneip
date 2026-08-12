import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'

function renderEm(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  )
}

describe('AppSidebar', () => {
  it('mostra os cinco itens de navegacao', () => {
    renderEm('/')
    for (const rotulo of ['Painel', 'Plantel', 'Calendário', 'Relatórios', 'Configurações']) {
      expect(screen.getByRole('link', { name: new RegExp(rotulo) })).toBeInTheDocument()
    }
  })

  it('marca o item ativo com aria-current', () => {
    renderEm('/catalogo')
    expect(screen.getByRole('link', { name: /Plantel/ })).toHaveAttribute('aria-current', 'page')
  })

  it('nao marca Painel como ativo em outra rota', () => {
    renderEm('/catalogo')
    expect(screen.getByRole('link', { name: /Painel/ })).not.toHaveAttribute('aria-current')
  })

  it('nao usa emoji como marca', () => {
    const { container } = renderEm('/')
    expect(container.textContent).not.toContain('🐴')
    expect(screen.getByText('HK')).toBeInTheDocument()
  })
})
