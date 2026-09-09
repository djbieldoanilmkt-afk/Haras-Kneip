import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderPage } from '@/test/renderPage'

const animal = vi.hoisted(() => (id: string, nome: string) => ({
  id,
  nome,
  apelido: null,
  registro: null,
  registro_abccmm: null,
  raca: 'Mangalarga Marchador',
  pelagem: 'Tordilha',
  tipo_marcha: 'Marcha Batida',
  sexo: 'Fêmea' as const,
  data_nascimento: '2020-05-11',
  peso: null,
  altura: null,
  baia_piquete: null,
  status_reprodutivo: 'Vazia',
  status_saude: null,
  premiacao: null,
  foto_url: null,
  observacoes: null,
  em_destaque: false,
  ativo: true,
  created_at: '2024-01-01',
  updated_at: null,
}))

const criarDespesa = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'd1' }))

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi
      .fn()
      .mockResolvedValue([animal('a1', 'Aurora'), animal('a2', 'Brisa'), animal('a3', 'Vencedor')]),
    getDespesas: vi.fn().mockResolvedValue([
      {
        id: 'd1',
        haras_id: 'h1',
        data: '2026-09-01',
        categoria: 'Ração e suplemento',
        descricao: 'Ração do mês',
        valor: 1200,
        fornecedor: 'Agro Central',
        observacoes: null,
        created_at: '2026-09-01',
        updated_at: null,
        rateios: [
          { animal_id: 'a1', animal: 'Aurora', valor: 400 },
          { animal_id: 'a2', animal: 'Brisa', valor: 400 },
          { animal_id: 'a3', animal: 'Vencedor', valor: 400 },
        ],
      },
    ]),
    getResumoCustos: vi.fn().mockResolvedValue({
      mesAtual: 1200,
      mesAnterior: 800,
      porMes: [{ mes: '2026-09', total: 1200 }],
      porAnimal: [{ animal_id: 'a1', animal: 'Aurora', total: 400 }],
      porCategoria: [
        { categoria: 'Ração e suplemento', total: 1200 },
        { categoria: 'Veterinário', total: 300 },
      ],
    }),
    createDespesa: criarDespesa,
    deleteDespesa: vi.fn().mockResolvedValue(undefined),
  },
}))

import Financeiro from './Financeiro'

beforeEach(() => vi.clearAllMocks())

describe('Financeiro', () => {
  it('mostra o gasto do mes e o custo medio por animal', async () => {
    renderPage(<Financeiro />)

    await waitFor(() => expect(screen.getByText('Gasto no mês')).toBeInTheDocument())
    // 1200 dividido por 3 animais no plantel.
    expect(screen.getByText('Custo médio por animal')).toBeInTheDocument()
    expect(screen.getByText('3 no plantel')).toBeInTheDocument()
  })

  it('lista o lancamento dizendo entre quantos animais foi rateado', async () => {
    renderPage(<Financeiro />)

    await waitFor(() => expect(screen.getByText('Ração do mês')).toBeInTheDocument())
    expect(screen.getByText(/Rateada entre 3 animais/)).toBeInTheDocument()
  })

  it('mostra o valor por cabeca enquanto os animais sao marcados', async () => {
    const usuario = userEvent.setup()
    renderPage(<Financeiro />)

    await waitFor(() => expect(screen.getByText('Gasto no mês')).toBeInTheDocument())
    await usuario.click(screen.getByRole('button', { name: /Nova despesa/ }))

    await usuario.type(screen.getByLabelText('Valor (R$)'), '100')
    await usuario.click(screen.getByRole('button', { name: 'Todos' }))

    // 100 entre 3 = 33,34 / 33,33 / 33,33: a faixa aparece, não uma média falsa.
    await waitFor(() => expect(screen.getByText(/R\$\s?33.+R\$\s?33/)).toBeInTheDocument())
  })

  it('nao envia rateio quando nenhum animal e escolhido', async () => {
    const usuario = userEvent.setup()
    renderPage(<Financeiro />)

    await waitFor(() => expect(screen.getByText('Gasto no mês')).toBeInTheDocument())
    await usuario.click(screen.getByRole('button', { name: /Nova despesa/ }))

    await usuario.type(screen.getByLabelText('Descrição'), 'Conserto da cerca')
    await usuario.type(screen.getByLabelText('Valor (R$)'), '500')
    await usuario.click(screen.getByRole('button', { name: /Lançar despesa/ }))

    await waitFor(() => expect(criarDespesa).toHaveBeenCalled())
    expect(criarDespesa.mock.calls[0][1]).toEqual([])
  })

  it('recusa valor zero em vez de gravar lancamento vazio', async () => {
    const usuario = userEvent.setup()
    renderPage(<Financeiro />)

    await waitFor(() => expect(screen.getByText('Gasto no mês')).toBeInTheDocument())
    await usuario.click(screen.getByRole('button', { name: /Nova despesa/ }))

    await usuario.type(screen.getByLabelText('Descrição'), 'Teste')
    await usuario.type(screen.getByLabelText('Valor (R$)'), '0')
    await usuario.click(screen.getByRole('button', { name: /Lançar despesa/ }))

    expect(await screen.findByText('Valor precisa ser maior que zero')).toBeInTheDocument()
    expect(criarDespesa).not.toHaveBeenCalled()
  })
})
