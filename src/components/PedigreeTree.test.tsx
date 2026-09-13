import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { PedigreeTree } from './PedigreeTree'
import type { Genealogia } from '@/lib/database.types'

const ANCESTRAIS = {
  p1: { nome: 'Vencedor JK', foto_url: null },
  m1: { nome: 'Estrela do Sul', foto_url: 'https://exemplo/estrela.jpg' },
  ap1: { nome: 'Rei do Vale', foto_url: null },
}

function genealogia(parcial: Partial<Genealogia>): Genealogia {
  return {
    id: 'g1',
    animal_id: 'a1',
    pai_id: null,
    mae_id: null,
    avo_paterno_id: null,
    avo_paterna_id: null,
    avo_materno_id: null,
    avo_materna_id: null,
    created_at: '2024-01-01',
    updated_at: null,
    ...parcial,
  }
}

function renderArvore(g: Genealogia | null) {
  return render(
    <MemoryRouter>
      <PedigreeTree genealogia={g} ancestrais={ANCESTRAIS} animalNome="Aurora da Kneip" />
    </MemoryRouter>,
  )
}

describe('PedigreeTree', () => {
  it('avisa quando nao ha genealogia', () => {
    renderArvore(null)
    expect(screen.getByText(/Sem dados de genealogia/)).toBeInTheDocument()
  })

  it('mostra o animal atual em destaque', () => {
    renderArvore(genealogia({ pai_id: 'p1' }))
    expect(screen.getByText('Aurora da Kneip')).toBeInTheDocument()
  })

  it('mostra pai e mae com link para o perfil', () => {
    renderArvore(genealogia({ pai_id: 'p1', mae_id: 'm1' }))
    expect(screen.getByRole('link', { name: /Vencedor JK/ })).toHaveAttribute('href', '/animal/p1')
    expect(screen.getByRole('link', { name: /Estrela do Sul/ })).toHaveAttribute('href', '/animal/m1')
  })

  it('mostra a miniatura da foto quando o ancestral tem foto', () => {
    renderArvore(genealogia({ mae_id: 'm1' }))
    const link = screen.getByRole('link', { name: /Estrela do Sul/ })
    expect(link.querySelector('img')).toHaveAttribute('src', 'https://exemplo/estrela.jpg')
  })

  it('mostra Desconhecido quando o ancestral nao esta preenchido', () => {
    renderArvore(genealogia({ pai_id: 'p1' }))
    expect(screen.getAllByText('Desconhecido').length).toBeGreaterThan(0)
  })

  it('nao cria link para ancestral desconhecido', () => {
    renderArvore(genealogia({ pai_id: 'p1' }))
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('mostra os avos quando preenchidos', () => {
    renderArvore(genealogia({ pai_id: 'p1', avo_paterno_id: 'ap1' }))
    expect(screen.getByRole('link', { name: /Rei do Vale/ })).toHaveAttribute('href', '/animal/ap1')
  })

  it('trata id que nao esta no mapa como desconhecido', () => {
    renderArvore(genealogia({ pai_id: 'inexistente' }))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
