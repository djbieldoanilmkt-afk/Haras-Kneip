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

const PLANTEL = vi.hoisted(() => {
  const base = {
    apelido: null,
    registro: null,
    raca: 'Mangalarga Marchador',
    tipo_marcha: 'Marcha Batida',
    sexo: 'Fêmea' as const,
    peso: null,
    altura: null,
    status_reprodutivo: 'Vazia',
    status_saude: null,
    premiacao: null,
    observacoes: null,
    em_destaque: false,
    ativo: true,
    created_at: '2024-01-01',
    updated_at: null,
  }
  return [
    { ...base, id: 'a1', nome: 'Aurora da Kneip', pelagem: 'Tordilha', data_nascimento: '2019-04-01', baia_piquete: 'Piquete 1', foto_url: 'x.jpg', registro_abccmm: 'A1' },
    { ...base, id: 'a2', nome: 'Vencedor JK', pelagem: 'Castanha', data_nascimento: '2018-02-01', baia_piquete: 'Piquete 1', foto_url: null, registro_abccmm: null },
    { ...base, id: 'a3', nome: 'Brisa Suave', pelagem: 'Alazã', data_nascimento: '2020-06-01', baia_piquete: null, foto_url: null, registro_abccmm: null },
  ]
})

const PESAGENS = vi.hoisted(() => [
  { animal_id: 'a1', animal: 'Aurora da Kneip', peso: 420, data_pesagem: '2026-08-01', variacao: 15 },
])

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi.fn().mockResolvedValue(PLANTEL),
    getStats: vi.fn().mockResolvedValue({
      totalAnimais: 9,
      femeas: 6,
      machos: 3,
      prenhas: 1,
      lactantes: 1,
      eventosProximos: [],
    }),
    getPesagensResumo: vi.fn().mockResolvedValue(PESAGENS),
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

describe('Painel — manejo e cadastro', () => {
  it('agrupa o plantel por piquete e mostra os nomes, nao so a contagem', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Ocupação')).toBeInTheDocument())
    expect(screen.getByText('Piquete 1')).toBeInTheDocument()
    expect(screen.getByText('Sem local definido')).toBeInTheDocument()
  })

  it('cobra os campos que faltam no cadastro', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Cadastro do plantel')).toBeInTheDocument())
    // 2 dos 3 animais estao sem foto e sem registro ABCCMM.
    expect(screen.getByText('Sem foto')).toBeInTheDocument()
    expect(screen.getByText('Sem registro ABCCMM')).toBeInTheDocument()
  })

  it('acusa o animal que nunca foi pesado, que nao aparece na tabela de pesagens', async () => {
    renderPage(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Pesagens')).toBeInTheDocument())
    expect(screen.getAllByText('Nunca pesado')).toHaveLength(2)
    expect(screen.getByText('420 kg')).toBeInTheDocument()
  })
})

describe('Painel — o que o peao nao ve', () => {
  it('esconde o dinheiro do peao', async () => {
    renderPage(<Dashboard />, { papel: 'peao' })

    await waitFor(() => expect(screen.getByText('Total de animais')).toBeInTheDocument())
    expect(screen.queryByText('Custo no mês')).not.toBeInTheDocument()
    expect(screen.queryByText('Custos de sanidade')).not.toBeInTheDocument()
  })

  it('nem chega a consultar as despesas quando o perfil nao ve financeiro', async () => {
    const { store } = await import('@/lib/store')
    renderPage(<Dashboard />, { papel: 'peao' })

    await waitFor(() => expect(screen.getByText('Total de animais')).toBeInTheDocument())
    // O RLS devolveria só a parte de sanidade, e o número sairia errado.
    expect(store.getResumoCustos).not.toHaveBeenCalled()
  })

  it('o peao continua vendo o manejo, que e o trabalho dele', async () => {
    renderPage(<Dashboard />, { papel: 'peao' })

    await waitFor(() => expect(screen.getByText('Ocupação')).toBeInTheDocument())
    expect(screen.getByText('Sanidade')).toBeInTheDocument()
    // Aparece no cartao de numero e no painel; ambos ficam para o peao.
    expect(screen.getAllByText('Partos previstos')).toHaveLength(2)
  })

  it('o gerente ve o dinheiro', async () => {
    renderPage(<Dashboard />, { papel: 'gerente' })
    await waitFor(() => expect(screen.getByText('Custo no mês')).toBeInTheDocument())
  })
})
