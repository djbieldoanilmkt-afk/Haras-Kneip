import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderPage } from '@/test/renderPage'

const bicho = vi.hoisted(
  () =>
    (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
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
      em_destaque: true,
      ativo: true,
      externo: false,
      created_at: '2024-01-01',
      updated_at: null,
      ...extra,
    }),
)

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi.fn().mockResolvedValue([
      bicho('1', 'Faísca do Kneip', { baia_piquete: 'Baia 2' }),
      bicho('2', 'Estrela D\'Alva', { registro_abccmm: 'MM-12345', status_reprodutivo: 'Prenha' }),
      bicho('3', 'Trovão Azul', { sexo: 'Macho', status_reprodutivo: null }),
    ]),
    getAllGenealogias: vi.fn().mockResolvedValue([]),
    toggleDestaque: vi.fn().mockResolvedValue(undefined),
    toggleAllDestaque: vi.fn().mockResolvedValue(undefined),
  },
}))

import Catalogo from './Catalogo'

beforeEach(() => vi.clearAllMocks())

async function abrir() {
  renderPage(<Catalogo />)
  await waitFor(() => expect(screen.getByText('Faísca do Kneip')).toBeInTheDocument())
  return userEvent.setup()
}

describe('Catalogo — busca', () => {
  it('acha o animal sem exigir o acento certo', async () => {
    const usuario = await abrir()
    // Quem digita no curral escreve "faisca"; cobrar o acento transformaria a
    // busca num teste de digitacao.
    await usuario.type(screen.getByLabelText('Buscar no plantel'), 'faisca')

    await waitFor(() => expect(screen.queryByText('Trovão Azul')).not.toBeInTheDocument())
    expect(screen.getByText('Faísca do Kneip')).toBeInTheDocument()
  })

  it('acha pelo registro da ABCCMM e pela baia', async () => {
    const usuario = await abrir()
    const campo = screen.getByLabelText('Buscar no plantel')

    await usuario.type(campo, 'MM-123')
    await waitFor(() => expect(screen.getByText("Estrela D'Alva")).toBeInTheDocument())
    expect(screen.queryByText('Faísca do Kneip')).not.toBeInTheDocument()

    await usuario.clear(campo)
    await usuario.type(campo, 'baia 2')
    await waitFor(() => expect(screen.getByText('Faísca do Kneip')).toBeInTheDocument())
    expect(screen.queryByText("Estrela D'Alva")).not.toBeInTheDocument()
  })

  it('soma busca e filtro em vez de um anular o outro', async () => {
    const usuario = await abrir()

    await usuario.click(screen.getByRole('button', { name: 'Prenhas' }))
    await waitFor(() => expect(screen.queryByText('Faísca do Kneip')).not.toBeInTheDocument())

    // "Estrela" DENTRO de "Prenhas" continua achando; "Trovão" nao, porque
    // nao passa no filtro.
    await usuario.type(screen.getByLabelText('Buscar no plantel'), 'estrela')
    await waitFor(() => expect(screen.getByText("Estrela D'Alva")).toBeInTheDocument())

    await usuario.clear(screen.getByLabelText('Buscar no plantel'))
    await usuario.type(screen.getByLabelText('Buscar no plantel'), 'trovao')
    await waitFor(() => expect(screen.queryByText('Trovão Azul')).not.toBeInTheDocument())
  })

  it('mostra o termo procurado quando nao acha nada, e deixa limpar', async () => {
    const usuario = await abrir()
    await usuario.type(screen.getByLabelText('Buscar no plantel'), 'zebra')

    // Repetir o termo evita o beco sem saida: quem digitou errado ve o proprio
    // erro em vez de concluir que o animal sumiu.
    expect(await screen.findByText(/Nada com "zebra"/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Limpar busca' }))
    await waitFor(() => expect(screen.getByText('Faísca do Kneip')).toBeInTheDocument())
  })

  it('conta quantos aparecem de quantos existem', async () => {
    const usuario = await abrir()
    expect(screen.getByText(/3 de 3 animais/)).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Buscar no plantel'), 'faisca')
    await waitFor(() => expect(screen.getByText(/1 de 3 animais/)).toBeInTheDocument())
  })
})
