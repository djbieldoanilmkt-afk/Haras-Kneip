import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  plano: 'haras' as const,
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
    getReceitas: vi.fn().mockResolvedValue([]),
    getLixeira: vi.fn().mockResolvedValue([]),
    getCustoPorCategoria: vi.fn().mockResolvedValue([]),
    getSaudeDoAgente: vi.fn().mockResolvedValue(null),
    restaurarRegistro: vi.fn().mockResolvedValue(undefined),
    createReceita: vi.fn().mockResolvedValue('r1'),
    getResumoFinanceiro: vi
      .fn()
      .mockResolvedValue({ receitas: 0, despesas: 0, saldo: 0 }),
    getMeuMembro: vi.fn().mockResolvedValue({
      haras_id: 'h1',
      user_id: 'u1',
      papel: 'dono' as const,
      telefone: '+5531999998888',
      telefone_verificado_em: null,
      created_at: '2026-01-01',
    }),
    salvarTelefone: vi.fn().mockResolvedValue(undefined),
    conexaoWhatsapp: vi.fn().mockResolvedValue({ estado: 'close' }),
    getMinhaEquipe: vi.fn().mockResolvedValue([
      {
        user_id: 'u1',
        email: 'dono@exemplo.com',
        papel: 'dono' as const,
        telefone: '+5531999998888',
        verificado_em: null,
        tem_pin: false,
        desde: '2026-01-01',
      },
      {
        user_id: 'u2',
        email: 'peao@exemplo.com',
        papel: 'peao' as const,
        telefone: null,
        verificado_em: null,
        tem_pin: false,
        desde: '2026-02-01',
      },
    ]),
    definirTelefoneMembro: vi.fn().mockResolvedValue(undefined),
    gerarPinTelefone: vi.fn().mockResolvedValue('482913'),
    getConvitesPendentes: vi.fn().mockResolvedValue([]),
    convidarMembro: vi.fn().mockResolvedValue(undefined),
    cancelarConvite: vi.fn().mockResolvedValue(undefined),
    removerMembro: vi.fn().mockResolvedValue(undefined),
    getMeusConvites: vi.fn().mockResolvedValue([]),
    aceitarConvite: vi.fn().mockResolvedValue(undefined),
    getSaudeRegistrosPlantel: vi.fn().mockResolvedValue([]),
    getReproducaoPlantel: vi.fn().mockResolvedValue([]),
    createSaudeRegistro: vi.fn().mockResolvedValue({ id: 's1' }),
    createReproducao: vi.fn().mockResolvedValue({ id: 'r1' }),
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
import Sanidade from './Sanidade'
import Reproducao from './Reproducao'
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
    expect(screen.getByText('Saiu no mês')).toBeInTheDocument()
  })

  it('Sanidade', async () => {
    renderPage(<Sanidade />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sanidade' })).toBeInTheDocument())
    expect(screen.getByText('Vencendo agora')).toBeInTheDocument()
  })

  it('Reproducao', async () => {
    renderPage(<Reproducao />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Reprodução' })).toBeInTheDocument(),
    )
    expect(screen.getByText('DG+ por cobertura')).toBeInTheDocument()
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
      <TenantProvider value={{ haras: HARAS, papel: 'dono' as const, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
    await waitFor(() => expect(screen.getByText('Informações do Haras')).toBeInTheDocument())
    expect(screen.getByText(/Ainda não disponível/)).toBeInTheDocument()
  })

  it('Configuracoes mostra a identidade e o endereco da vitrine', async () => {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel: 'dono' as const, recarregar: () => {} }}>
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

describe('Configuracoes — Equipe', () => {
  function renderEquipe() {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel: 'dono' as const, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
  }

  it('mostra a ocupacao contra o limite do plano', async () => {
    renderEquipe()
    // HARAS está no plano 'haras', que vai até 3.
    await waitFor(() => expect(screen.getByText(/2 de 3 no plano Haras/)).toBeInTheDocument())
  })

  it('nao oferece remover o dono, que deixaria a conta orfa', async () => {
    renderEquipe()
    await waitFor(() => expect(screen.getByText('dono@exemplo.com')).toBeInTheDocument())
    expect(screen.queryByLabelText('Remover dono@exemplo.com')).not.toBeInTheDocument()
  })

  it('convida usando o codigo do papel, e nao o rotulo da tela', async () => {
    const usuario = userEvent.setup()
    const { store } = await import('@/lib/store')

    renderEquipe()
    const campo = await screen.findByLabelText('E-mail de quem entra')
    await usuario.type(campo, 'peao@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: /Convidar/ }))

    // 'Peão' é o texto; 'peao' é o que o check constraint aceita.
    await waitFor(() =>
      expect(store.convidarMembro).toHaveBeenCalledWith('peao@exemplo.com', 'peao'),
    )
  })
})

describe('Configuracoes — verificacao por PIN', () => {
  function renderEquipe() {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel: 'dono' as const, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
  }

  it('marca como nao verificado quem tem numero mas nao provou', async () => {
    renderEquipe()
    await waitFor(() => expect(screen.getByText('dono@exemplo.com')).toBeInTheDocument())
    // Só o dono tem número cadastrado; o peão não mostra estado nenhum.
    expect(screen.getAllByText(/não verificado/)).toHaveLength(1)
  })

  it('mostra o PIN e diz de qual aparelho a mensagem tem que sair', async () => {
    const usuario = userEvent.setup()
    renderEquipe()

    await waitFor(() => expect(screen.getByText('dono@exemplo.com')).toBeInTheDocument())
    await usuario.click(screen.getByLabelText('WhatsApp de dono@exemplo.com'))
    await usuario.click(await screen.findByRole('button', { name: /Gerar PIN/ }))

    expect(await screen.findByText('482913')).toBeInTheDocument()
    // O número precisa aparecer junto: o PIN só vale vindo daquele aparelho.
    expect(screen.getAllByText(/\(31\) 99999-8888/).length).toBeGreaterThan(0)

    /*
      E precisa CONTINUAR na tela depois que a recarga da lista terminar.
      Sem esta espera o teste passava por sorte: ele encontrava o PIN no
      instante entre gerar e a recarga desmontar o painel.
    */
    await waitFor(() => expect(screen.getByText('dono@exemplo.com')).toBeInTheDocument())
    expect(screen.getByText('482913')).toBeInTheDocument()
  })

  it('nao oferece PIN para quem ainda nao tem numero cadastrado', async () => {
    const usuario = userEvent.setup()
    renderEquipe()

    await waitFor(() => expect(screen.getByText('peao@exemplo.com')).toBeInTheDocument())
    await usuario.click(screen.getByLabelText('WhatsApp de peao@exemplo.com'))

    expect(await screen.findByLabelText(/Número do WhatsApp/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gerar PIN/ })).not.toBeInTheDocument()
  })
})

describe('Configuracoes — um campo de telefone so', () => {
  it('nao existe mais um cartao WhatsApp separado do da equipe', async () => {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel: 'dono' as const, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )

    await waitFor(() => expect(screen.getByText('Equipe')).toBeInTheDocument())

    // Dois lugares para o mesmo telefone mostravam estados diferentes do mesmo
    // dado: o card avulso com o valor digitado e a linha da equipe com o que
    // estava no banco.
    expect(screen.queryByLabelText('Seu número')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar telefone' })).not.toBeInTheDocument()
  })
})

describe('Configuracoes — conexao do WhatsApp', () => {
  function render(papel: 'dono' | 'peao' = 'dono') {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel, recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
      { papel },
    )
  }

  it('oferece a conexao ao dono', async () => {
    render('dono')
    await waitFor(() => expect(screen.getByText('Número do assistente')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Conectar WhatsApp/ })).toBeInTheDocument()
  })

  it('nao mostra a conexao para o peao', async () => {
    render('peao')
    await waitFor(() => expect(screen.getByText('Equipe')).toBeInTheDocument())
    // A sessão vale para o haras inteiro; conectar é ato de dono.
    expect(screen.queryByText('Número do assistente')).not.toBeInTheDocument()
  })

  it('mostra o QR depois de pedir a conexao', async () => {
    const usuario = userEvent.setup()
    const { store } = await import('@/lib/store')
    vi.mocked(store.conexaoWhatsapp).mockResolvedValueOnce({ estado: 'close' })
    vi.mocked(store.conexaoWhatsapp).mockResolvedValueOnce({
      estado: 'connecting',
      qr: 'data:image/png;base64,AAAA',
    })

    render('dono')
    await usuario.click(await screen.findByRole('button', { name: /Conectar WhatsApp/ }))

    const img = await screen.findByAltText('QR Code para conectar o WhatsApp')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA')
  })
})

describe('Configuracoes — confirmacao e desvinculo', () => {
  function render() {
    renderPage(
      <TenantProvider value={{ haras: HARAS, papel: 'dono', recarregar: () => {} }}>
        <Configuracoes />
      </TenantProvider>,
    )
  }

  it('mostra confirmado, sem PIN, quando o numero ja foi verificado', async () => {
    const usuario = userEvent.setup()
    const { store } = await import('@/lib/store')

    /*
      Estado final, e nao o instante da troca.

      A versao anterior deste teste tentava flagrar o PIN na tela entre gerar
      e a recarga confirmar — uma janela de milissegundos que passava ou
      falhava conforme a maquina. Ja tive um teste passando por sorte assim.
    */
    vi.mocked(store.getMinhaEquipe).mockResolvedValue([
      {
        user_id: 'u1',
        email: 'dono@exemplo.com',
        papel: 'dono' as const,
        telefone: '+5531999998888',
        verificado_em: '2026-09-10T13:18:58Z',
        tem_pin: false,
        desde: '2026-01-01',
      },
    ])

    render()
    await usuario.click(await screen.findByLabelText('WhatsApp de dono@exemplo.com'))

    expect(await screen.findByText(/Confirmado em/)).toBeInTheDocument()
    // Numero ja provado nao precisa de codigo novo.
    expect(screen.queryByRole('button', { name: /Gerar PIN/ })).not.toBeInTheDocument()
  })

  it('desvincula o numero', async () => {
    const usuario = userEvent.setup()
    const { store } = await import('@/lib/store')

    render()
    await usuario.click(await screen.findByLabelText('WhatsApp de dono@exemplo.com'))
    await usuario.click(await screen.findByRole('button', { name: /Desvincular/ }))

    // A propria linha usa o caminho de menor privilegio.
    await waitFor(() => expect(store.salvarTelefone).toHaveBeenCalledWith(null))
  })
})
