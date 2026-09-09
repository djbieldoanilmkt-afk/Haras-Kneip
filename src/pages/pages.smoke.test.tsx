import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderPage } from '@/test/renderPage'

// vi.hoisted porque a fabrica do vi.mock e icada para o topo do arquivo e nao
// enxerga constantes declaradas depois.
const ANIMAL = vi.hoisted(() => ({
  id: 'a1',
  nome: 'Aurora da Kneip',
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
  status_reprodutivo: 'Prenha',
  status_saude: null,
  premiacao: null,
  foto_url: null,
  observacoes: null,
  em_destaque: true,
  ativo: true,
  created_at: '2024-01-01',
  updated_at: null,
}))

const HARAS = vi.hoisted(() => ({
  id: 'h1',
  nome: 'Haras Kneip',
  slug: 'haras-kneip',
  logo_url: null,
  status_conta: 'ativa' as const,
  trial_expira_em: '2099-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
}))

vi.mock('@/lib/store', () => ({
  store: {
    meuHarasId: vi.fn().mockResolvedValue('h1'),
    getHarasPorSlug: vi.fn().mockResolvedValue(HARAS),
    getVitrine: vi.fn().mockResolvedValue({ animais: [], genealogias: [] }),
    getAnimais: vi.fn().mockResolvedValue([]),
    getAnimal: vi.fn().mockResolvedValue(ANIMAL),
    getAllGenealogias: vi.fn().mockResolvedValue([]),
    getGenealogia: vi.fn().mockResolvedValue(null),
    getAnimaisMap: vi.fn().mockResolvedValue({}),
    getSaudeRegistros: vi.fn().mockResolvedValue([]),
    getReproducao: vi.fn().mockResolvedValue([]),
    getAnotacoes: vi.fn().mockResolvedValue([]),
    getPesagens: vi.fn().mockResolvedValue([]),
    getEventos: vi.fn().mockResolvedValue([]),
    getConfiguracoes: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({
      totalAnimais: 0,
      femeas: 0,
      machos: 0,
      prenhas: 0,
      lactantes: 0,
      eventosProximos: [],
    }),
    getPesagensResumo: vi.fn().mockResolvedValue([]),
    getPendenciasSanitarias: vi.fn().mockResolvedValue([]),
    getPartosPrevistos: vi.fn().mockResolvedValue([]),
    getResumoCustos: vi.fn().mockResolvedValue({
      mesAtual: 0,
      mesAnterior: 0,
      porMes: [],
      porAnimal: [],
      porCategoria: [],
    }),
    getDespesas: vi.fn().mockResolvedValue([]),
    createDespesa: vi.fn().mockResolvedValue({ id: 'd1' }),
    deleteDespesa: vi.fn().mockResolvedValue(undefined),
  },
}))

import { TenantProvider } from '@/hooks/tenant'
import Dashboard from './Dashboard'
import Catalogo from './Catalogo'
import Perfil from './Perfil'
import AnimalForm from './AnimalForm'
import Calendario from './Calendario'
import Financeiro from './Financeiro'
import Relatorios from './Relatorios'
import Configuracoes from './Configuracoes'
import PlantelPublico from './PlantelPublico'

beforeEach(() => vi.clearAllMocks())

describe('smoke de renderizacao das paginas', () => {
  it('Painel', async () => {
    renderPage(<Dashboard />)
    await waitFor(() => expect(screen.getByText('Painel do Plantel')).toBeInTheDocument())
    expect(screen.getByText('Total de animais')).toBeInTheDocument()
  })

  it('Financeiro', async () => {
    renderPage(<Financeiro />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument())
    expect(screen.getByText('Gasto no mês')).toBeInTheDocument()
  })

  it('Plantel', async () => {
    renderPage(<Catalogo />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Plantel' })).toBeInTheDocument(),
    )
    expect(screen.getByText(/Link de apresentação/)).toBeInTheDocument()
  })

  it('Perfil', async () => {
    renderPage(<Perfil />, { path: '/animal/:id', route: '/animal/a1' })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Aurora da Kneip' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('tab', { name: 'Genealogia' })).toBeInTheDocument()
  })

  it('Novo animal', async () => {
    renderPage(<AnimalForm />, { path: '/novo-animal', route: '/novo-animal' })
    await waitFor(() => expect(screen.getByLabelText(/Nome completo/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Salvar animal/ })).toBeInTheDocument()
  })

  it('Editar animal carrega os dados', async () => {
    renderPage(<AnimalForm />, { path: '/editar-animal/:id', route: '/editar-animal/a1' })
    await waitFor(() =>
      expect(screen.getByLabelText(/Nome completo/)).toHaveValue('Aurora da Kneip'),
    )
  })

  it('Calendario', async () => {
    renderPage(<Calendario />)
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument()
  })

  it('Relatorios', async () => {
    renderPage(<Relatorios />)
    await waitFor(() => expect(screen.getByText(/Exportar CSV/)).toBeInTheDocument())
    expect(screen.getByText('Idade média (anos)')).toBeInTheDocument()
  })

  it('Configuracoes', async () => {
    renderPage(
      <TenantProvider value={{ haras: HARAS, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
    await waitFor(() => expect(screen.getByText('Informações do Haras')).toBeInTheDocument())
    expect(screen.getByText(/Ainda não disponível/)).toBeInTheDocument()
  })

  it('Configuracoes mostra a identidade e o endereco da vitrine', async () => {
    renderPage(
      <TenantProvider value={{ haras: HARAS, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
    await waitFor(() => expect(screen.getByText('Identidade do haras')).toBeInTheDocument())
    expect(screen.getByLabelText('Endereço da vitrine')).toHaveValue('haras-kneip')
  })

  it('Plantel publico roda sem o shell, pelo slug da URL', async () => {
    renderPage(<PlantelPublico />, { path: '/plantel/:slug', route: '/plantel/haras-kneip' })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Haras Kneip' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
