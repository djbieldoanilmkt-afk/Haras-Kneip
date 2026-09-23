import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderPage } from '@/test/renderPage'

// vi.hoisted porque a fabrica do vi.mock e icada para o topo do arquivo.
const ANIMAL = vi.hoisted(() => ({
  id: 'a1',
  nome: 'Manhosa do Kneip',
  apelido: null,
  registro: null,
  registro_abccmm: '0240542',
  raca: 'Mangalarga Marchador',
  pelagem: 'Alazã',
  tipo_marcha: null,
  sexo: 'Fêmea' as const,
  data_nascimento: '2022-04-17',
  peso: null,
  altura: null,
  baia_piquete: null,
  status_reprodutivo: 'Vazia',
  status_saude: 'Saudável',
  premiacao: null,
  foto_url: null,
  observacoes: null,
  em_destaque: false,
  ativo: true,
  created_at: '2024-01-01',
  updated_at: null,
}))

vi.mock('@/lib/store', () => ({
  store: {
    getAnimal: vi.fn().mockResolvedValue(ANIMAL),
    getAnimais: vi.fn().mockResolvedValue([]),
    getAnimaisMap: vi.fn().mockResolvedValue({}),
    getGenealogia: vi.fn().mockResolvedValue(null),
    getPesagens: vi.fn().mockResolvedValue([]),
    getSaudeRegistros: vi.fn().mockResolvedValue([]),
    getReproducao: vi.fn().mockResolvedValue([]),
    getAnotacoes: vi.fn().mockResolvedValue([]),
  },
}))

import Perfil from './Perfil'

async function abrirPerfil() {
  renderPage(<Perfil />, { path: '/animal/:id', route: '/animal/a1' })
  await waitFor(() => expect(screen.getByText('Manhosa do Kneip')).toBeInTheDocument())
}

describe('Perfil do animal', () => {
  /*
    A razao de ser das duas colunas.

    Antes estes campos moravam dentro da aba "Informacoes": para ver o registro
    do animal era preciso estar na aba certa, e sair dela apagava a informacao
    da tela. Registro, nascimento e sexo sao a identidade do bicho -- ficam de
    fora das abas.
  */
  it('mostra a ficha do animal sem precisar abrir aba nenhuma', async () => {
    await abrirPerfil()

    expect(screen.getByText('0240542')).toBeInTheDocument()
    expect(screen.getByText('17/04/2022')).toBeInTheDocument()
    expect(screen.getByText('Égua')).toBeInTheDocument()
  })

  it('mantem a ficha na tela depois de trocar de aba', async () => {
    await abrirPerfil()
    await userEvent.click(screen.getByRole('tab', { name: 'Genealogia' }))

    await waitFor(() => expect(screen.getByText('Árvore genealógica')).toBeInTheDocument())
    expect(screen.getByText('0240542')).toBeInTheDocument()
    expect(screen.getByText('17/04/2022')).toBeInTheDocument()
  })

  /*
    O titulo da pagina era "Perfil do animal" -- que quem clicou no animal ja
    sabia. O nome do animal e a unica coisa ali que informa alguma coisa.
  */
  it('usa o nome do animal como titulo da pagina', async () => {
    await abrirPerfil()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Manhosa do Kneip')
    expect(screen.queryByText('Perfil do animal')).not.toBeInTheDocument()
  })

  it('oferece as cinco secoes numa barra de abas so', async () => {
    await abrirPerfil()

    const barra = screen.getByRole('tablist')
    expect(within(barra).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Resumo',
      'Genealogia',
      'Saúde',
      'Reprodução',
      'Anotações',
    ])
  })

  /*
    O peso e o unico dado da ficha que muda toda semana, entao ele nao cabe na
    coluna fixa: precisa de largura para o grafico. Fica na primeira aba, que
    abre sozinha.
  */
  it('abre no resumo, com o historico de peso ja visivel', async () => {
    await abrirPerfil()

    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Histórico de peso')).toBeInTheDocument()
  })
})
