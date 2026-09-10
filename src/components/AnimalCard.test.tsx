import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AnimalCard, iniciais } from './AnimalCard'
import type { Animal } from '@/lib/database.types'

const base: Animal = {
  id: 'a1',
  nome: 'Aurora da Kneip',
  apelido: null,
  registro: null,
  registro_abccmm: null,
  raca: 'Mangalarga Marchador',
  pelagem: 'Tordilha',
  tipo_marcha: 'Marcha Batida',
  sexo: 'Fêmea',
  data_nascimento: '2020-05-11',
  peso: null,
  altura: null,
  baia_piquete: null,
  status_reprodutivo: 'Prenha',
  status_saude: null,
  premiacao: null,
  foto_url: null,
  observacoes: null,
  em_destaque: true,
  ativo: true,
  externo: false,
  created_at: '2024-01-01',
  updated_at: null,
}

function renderCard(
  animal: Animal,
  linhagem?: { pai_nome: string | null; mae_nome: string | null },
) {
  return render(
    <MemoryRouter>
      <AnimalCard animal={animal} linhagem={linhagem} />
    </MemoryRouter>,
  )
}

describe('iniciais', () => {
  it('usa as duas primeiras palavras', () => {
    expect(iniciais('Aurora da Kneip')).toBe('AD')
  })

  it('cai em HK quando nao ha nome', () => {
    expect(iniciais(null)).toBe('HK')
    expect(iniciais('')).toBe('HK')
  })
})

describe('AnimalCard', () => {
  it('mostra nome, pelagem e status', () => {
    renderCard(base)
    expect(screen.getByText('Aurora da Kneip')).toBeInTheDocument()
    expect(screen.getByText(/Tordilha/)).toBeInTheDocument()
    expect(screen.getByText('Prenha')).toBeInTheDocument()
  })

  it('liga para o perfil do animal', () => {
    renderCard(base)
    expect(screen.getByRole('link', { name: /Aurora da Kneip/ })).toHaveAttribute(
      'href',
      '/animal/a1',
    )
  })

  it('usa as iniciais quando nao ha foto', () => {
    renderCard(base)
    expect(screen.getByText('AD')).toBeInTheDocument()
  })

  it('mostra a foto quando existe', () => {
    renderCard({ ...base, foto_url: 'https://exemplo/foto.jpg' })
    expect(screen.getByRole('img', { name: 'Aurora da Kneip' })).toHaveAttribute(
      'src',
      'https://exemplo/foto.jpg',
    )
  })

  it('mostra a linhagem quando informada', () => {
    renderCard(base, { pai_nome: 'Vencedor JK', mae_nome: null })
    expect(screen.getByText(/Vencedor JK/)).toBeInTheDocument()
  })

  it('omite a linhagem quando nao ha pai nem mae', () => {
    renderCard(base, { pai_nome: null, mae_nome: null })
    expect(screen.queryByText(/Pai:/)).not.toBeInTheDocument()
  })

  it('omite o badge quando nao ha status reprodutivo', () => {
    renderCard({ ...base, status_reprodutivo: null })
    expect(screen.queryByText('Prenha')).not.toBeInTheDocument()
  })
})
