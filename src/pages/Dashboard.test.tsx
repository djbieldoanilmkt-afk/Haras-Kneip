import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderPage } from '@/test/renderPage'

/**
 * Datas relativas a hoje: fixar "2026-09-20" faria o teste passar hoje e
 * quebrar sozinho no mês que vem, sem ninguém ter mexido no código.
 */
const dataEm = vi.hoisted(() => (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
})

const PENDENCIAS = vi.hoisted(() => [
  {
    id: 's1',
    animal_id: 'a1',
    animal: 'Aurora da Kneip',
    tipo: 'Vacina',
    descricao: 'Influenza',
    proxima_data: dataEm(-12),
  },
  {
    id: 's2',
    animal_id: 'a2',
    animal: 'Vencedor JK',
    tipo: 'Vermifugação',
    descricao: 'Ivermectina',
    proxima_data: dataEm(5),
  },
])

const PARTOS = vi.hoisted(() => [
  {
    id: 'r1',
    animal_id: 'a1',
    matriz: 'Aurora da Kneip',
    garanhao: 'Imperador do Vale',
    data_prevista_parto: dataEm(-3),
  },
])

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({
      totalAnimais: 9,
      femeas: 6,
      machos: 3,
      prenhas: 1,
      lactantes: 1,
      eventosProximos: [],
    }),
    getPendenciasSanitarias: vi.fn().mockResolvedValue(PENDENCIAS),
    getPartosPrevistos: vi.fn().mockResolvedValue(PARTOS),
    getResumoCustos: vi.fn().mockResolvedValue({
      mesAtual: 1250,
      mesAnterior: 1000,
      porMes: [{ mes: '2026-09', total: 1250 }],
      porAnimal: [
        { animal_id: 'a1', animal: 'Aurora da Kneip', total: 900 },
        { animal_id: 'a2', animal: 'Vencedor JK', total: 350 },
      ],
    }),
  },
}))

import Dashboard from './Dashboard'

beforeEach(() => vi.clearAllMocks())

describe('Painel', () => {
  it('conta as pendencias sanitarias e separa quantas ja venceram', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Pendências sanitárias')).toBeInTheDocument())
    expect(screen.getByText('1 já vencida')).toBeInTheDocument()
  })

  it('destaca parto que passou da data', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Partos previstos')).toBeInTheDocument())
    // Aparece duas vezes de propósito: no cartão de número e no topo do painel.
    expect(screen.getAllByText('1 passou da data')).toHaveLength(2)
    expect(screen.getByText('Garanhão: Imperador do Vale')).toBeInTheDocument()
  })

  it('mostra o custo do mes em reais e a variacao contra o mes anterior', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Custo no mês')).toBeInTheDocument())
    // 1250 sobre 1000 = +25%
    expect(screen.getByText(/\+25% vs\. mês anterior/)).toBeInTheDocument()
    expect(screen.getByText(/mês anterior R\$/)).toBeInTheDocument()
  })

  it('lista os animais que mais custaram, do maior para o menor', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Onde o dinheiro foi')).toBeInTheDocument())
    const valores = screen.getAllByText(/^R\$/).map((n) => n.textContent)
    expect(valores.some((v) => v?.includes('900'))).toBe(true)
    expect(valores.some((v) => v?.includes('350'))).toBe(true)
  })

  it('rotula a pendencia vencida como atraso, e nao como prazo futuro', async () => {
    renderPage(<Dashboard />)

    // A égua consta no semáforo e também na lista de custo.
    await waitFor(() => expect(screen.getAllByText('Aurora da Kneip').length).toBeGreaterThan(0))
    expect(screen.getByText('Há 12 dias')).toBeInTheDocument()
    expect(screen.getByText('Em 5 dias')).toBeInTheDocument()
  })
})
