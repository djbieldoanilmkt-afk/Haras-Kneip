import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderPage } from '@/test/renderPage'

const criar = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'r1' }))

const egua = vi.hoisted(
  () => (id: string, nome: string, sexo: 'Fêmea' | 'Macho' = 'Fêmea') => ({
    id,
    nome,
    apelido: null,
    registro: null,
    registro_abccmm: null,
    raca: 'Mangalarga Marchador',
    pelagem: 'Tordilha',
    tipo_marcha: 'Marcha Batida',
    sexo,
    data_nascimento: '2019-03-15',
    peso: null,
    altura: null,
    baia_piquete: null,
    status_reprodutivo: sexo === 'Fêmea' ? 'Vazia' : 'Garanhão Ativo',
    funcao_reprodutiva: null,
    status_saude: null,
    premiacao: null,
    foto_url: null,
    observacoes: null,
    em_destaque: false,
    ativo: true,
    externo: false,
    created_at: '2024-01-01',
    updated_at: null,
  }),
)

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi.fn().mockResolvedValue([
      egua('a1', 'Aurora'),
      egua('a2', 'Fumaça'),
      egua('m1', 'Imperador', 'Macho'),
    ]),
    getReproducao: vi.fn().mockResolvedValue([]),
    getPartosPrevistos: vi.fn().mockResolvedValue([]),
    getReproducaoPlantel: vi.fn().mockResolvedValue([]),
    createReproducao: criar,
    excluirRegistro: vi.fn().mockResolvedValue(undefined),
    restaurarRegistro: vi.fn().mockResolvedValue(undefined),
  },
}))

import Reproducao from './Reproducao'

beforeEach(() => vi.clearAllMocks())

async function abrirFormulario() {
  const usuario = userEvent.setup()
  renderPage(<Reproducao />)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Novo evento/i })).toBeInTheDocument(),
  )
  await usuario.click(screen.getByRole('button', { name: /Novo evento/i }))
  return usuario
}

describe('Reproducao — receptora', () => {
  it('nao oferece receptora fora da transferencia de embriao', async () => {
    await abrirFormulario()
    // Oferecer sempre convidaria a preencher numa monta natural, onde
    // receptora nao existe.
    expect(screen.queryByText(/Receptora/i)).toBeNull()
  })

  it('pede a receptora quando o metodo e transferencia', async () => {
    const usuario = await abrirFormulario()

    // O seletor de metodo abre pelo texto do placeholder: o rotulo "Metodo"
    // nao esta associado ao controle (o Campo nao recebe htmlFor).
    await usuario.click(screen.getByText('Não informado'))
    await usuario.click(await screen.findByRole('option', { name: 'Transferência de Embrião' }))

    expect(await screen.findByText('Receptora — quem gesta e pare')).toBeInTheDocument()
    // O aviso e a salvaguarda: sem ele, "matriz" e "receptora" parecem
    // intercambiaveis e o potro nasce com a mae errada na arvore.
    expect(screen.getByText(/mãe genética/i)).toBeInTheDocument()
  })
})
