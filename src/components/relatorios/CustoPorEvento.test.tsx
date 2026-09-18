import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const eventos = vi.hoisted(() => vi.fn())
vi.mock('@/lib/store', () => ({ store: { getCustoPorEvento: eventos } }))

import { CustoPorEvento } from './CustoPorEvento'

const COPA = {
  eventoId: 'e1',
  titulo: 'Copa de Março',
  tipo: 'Competição',
  data: '2026-03-14',
  animais: 3,
  total: 1550,
  porCategoria: [
    { categoria: 'Transporte', total: 800 },
    { categoria: 'Taxas e registro', total: 450 },
    { categoria: 'Ração e suplemento', total: 300 },
  ],
}

async function esperarResposta() {
  await waitFor(() => expect(eventos).toHaveBeenCalled())
  await act(async () => {})
}

beforeEach(() => vi.clearAllMocks())

describe('CustoPorEvento', () => {
  it('mostra o total do evento e a quebra por categoria', async () => {
    eventos.mockResolvedValue([COPA])
    render(<CustoPorEvento />)

    const linha = (await screen.findByText('Copa de Março')).closest('li')
    // As duas perguntas de Seu Helio na mesma frase: "quanto gastei no evento
    // E em alimentacao".
    expect(linha?.textContent).toContain('1.550')
    expect(linha?.textContent).toContain('Transporte')
    expect(linha?.textContent).toContain('800')
    expect(linha?.textContent).toContain('3 animais')
  })

  it('some quando nenhum evento teve despesa', async () => {
    // Evento sem custo e agenda, nao centro de custo -- e um quadro vazio
    // ocuparia espaco de relatorio dizendo nada.
    eventos.mockResolvedValue([])
    render(<CustoPorEvento />)
    await esperarResposta()
    expect(screen.queryByText('Custo por evento')).toBeNull()
  })

  it('some quando a consulta falha, sem derrubar a pagina', async () => {
    eventos.mockRejectedValue(new Error('sem permissão'))
    render(<CustoPorEvento />)
    await esperarResposta()
    expect(screen.queryByText('Custo por evento')).toBeNull()
  })

  it('nao inventa contagem de animais quando ninguem foi marcado', async () => {
    eventos.mockResolvedValue([{ ...COPA, animais: 0 }])
    render(<CustoPorEvento />)
    const linha = (await screen.findByText('Copa de Março')).closest('li')
    expect(linha?.textContent).not.toContain('0 animais')
  })
})
