import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderPage } from '@/test/renderPage'
import type { PainelAvaliacao } from '@/lib/database.types'

const PECAS = vi.hoisted(() =>
  [
    ['LATERAL_ESQ', 'foto do lado esquerdo', 'foto'],
    ['LATERAL_DIR', 'foto do lado direito', 'foto'],
    ['FRENTE', 'foto de frente', 'foto'],
    ['TRASEIRA', 'foto de trás', 'foto'],
    ['CABECA_FRENTE', 'foto da cabeça de frente', 'foto'],
    ['CABECA_PERFIL', 'foto da cabeça de perfil', 'foto'],
    ['VIDEO_360', 'vídeo da volta completa', 'video'],
    ['VIDEO_FRENTE_TRAS', 'vídeo indo e voltando', 'video'],
    ['VIDEO_LATERAL', 'vídeo passando de lado', 'video'],
  ].map(([papel, rotulo, tipo]) => ({
    papel,
    rotulo,
    tipo,
    enviada: false,
    caminho: null,
    validacao: null,
    observacao: null,
    bytes: null,
    quadros: null,
  })),
)

const store = vi.hoisted(() => ({
  getAvaliacoes: vi.fn(),
  getAnimais: vi.fn().mockResolvedValue([
    { id: 'a1', nome: 'Manhosa do Kneip', sexo: 'Fêmea' },
    { id: 'a2', nome: 'Trovão da Serra', sexo: 'Macho' },
  ]),
  abrirAvaliacao: vi.fn(),
  getPainelAvaliacao: vi.fn(),
  cancelarAvaliacao: vi.fn(),
  enviarMidiaAvaliacao: vi.fn(),
  linkMorfologia: vi.fn().mockResolvedValue('https://exemplo/laudo.pdf'),
  meuHarasId: vi.fn().mockResolvedValue('h1'),
}))

vi.mock('@/lib/store', () => ({ store }))

import Morfologia from './Morfologia'
import MorfologiaAvaliacao from './MorfologiaAvaliacao'

function painel(extra: Partial<PainelAvaliacao> = {}): PainelAvaliacao {
  return {
    avaliacao_id: 'av1',
    estado: 'PEDIR_LATERAL_ESQ',
    origem: 'app',
    finalidade: null,
    iniciada_em: '2026-09-20T10:00:00Z',
    concluida_em: null,
    nota_geral: null,
    confianca: null,
    qualidade_material: null,
    potencial: null,
    erro: null,
    completo: false,
    animal: { nome: 'Manhosa do Kneip', animal_id: 'a1', sexo: 'Fêmea', idade_meses: 53 },
    material: PECAS.map((p) => ({ ...p })) as PainelAvaliacao['material'],
    tarefas: [],
    laudo: null,
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  store.getAnimais.mockResolvedValue([
    { id: 'a1', nome: 'Manhosa do Kneip', sexo: 'Fêmea' },
    { id: 'a2', nome: 'Trovão da Serra', sexo: 'Macho' },
  ])
  store.linkMorfologia.mockResolvedValue('https://exemplo/laudo.pdf')
  store.meuHarasId.mockResolvedValue('h1')
})

describe('lista de avaliações', () => {
  it('convida a começar quando não há nenhuma', async () => {
    store.getAvaliacoes.mockResolvedValue([])
    renderPage(<Morfologia />, { path: '/morfologia', route: '/morfologia' })

    await waitFor(() => expect(screen.getByText('Nenhuma avaliação ainda')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Começar uma avaliação/ })).toBeInTheDocument()
  })

  /*
    O WhatsApp e o site nao sao dois modulos: sao duas portas para a mesma
    avaliacao. Listas separadas fariam o dono procurar em dois lugares o laudo
    de um cavalo so.
  */
  it('mostra na mesma lista o que veio do site e o que veio do WhatsApp', async () => {
    store.getAvaliacoes.mockResolvedValue([
      {
        avaliacao_id: 'av1', estado: 'CONCLUIDA', origem: 'whatsapp', finalidade: null,
        nota_geral: 7.5, confianca: 8, qualidade_material: 88,
        iniciada_em: '2026-09-20T10:00:00Z', concluida_em: '2026-09-20T11:00:00Z',
        erro: null, animal: 'Manhosa do Kneip', animal_id: 'a1',
        laudo: 'h1/av1/laudo.pdf', pecas: 9,
      },
      {
        avaliacao_id: 'av2', estado: 'PEDIR_FRENTE', origem: 'app', finalidade: null,
        nota_geral: null, confianca: null, qualidade_material: null,
        iniciada_em: '2026-09-21T10:00:00Z', concluida_em: null,
        erro: null, animal: 'Trovão da Serra', animal_id: 'a2', laudo: null, pecas: 2,
      },
    ])
    renderPage(<Morfologia />, { path: '/morfologia', route: '/morfologia' })

    await waitFor(() => expect(screen.getByText('Manhosa do Kneip')).toBeInTheDocument())
    expect(screen.getByText('Trovão da Serra')).toBeInTheDocument()

    /* Concluida mostra a nota; em coleta, o que ainda falta. */
    expect(screen.getByText('7,5')).toBeInTheDocument()
    expect(screen.getByText('2 de 9 peças')).toBeInTheDocument()
  })

  /*
    Lista vazia e lista que nao carregou sao duas coisas.

    O recurso pode nao estar liberado para o haras, e o banco recusa. Dizer
    "nenhuma avaliacao ainda" mandaria a pessoa clicar em "comecar" para
    receber o mesmo erro, sem nunca saber o motivo.
  */
  it('não confunde lista vazia com lista que não carregou', async () => {
    store.getAvaliacoes.mockRejectedValue(
      new Error('A avaliação morfológica não está liberada para este haras.'),
    )
    renderPage(<Morfologia />, { path: '/morfologia', route: '/morfologia' })

    await waitFor(() =>
      expect(screen.getByText(/não está liberada para este haras/)).toBeInTheDocument(),
    )
    expect(screen.queryByText('Nenhuma avaliação ainda')).not.toBeInTheDocument()
  })

  it('abre a avaliação do animal escolhido', async () => {
    store.getAvaliacoes.mockResolvedValue([])
    store.abrirAvaliacao.mockResolvedValue({
      ok: true, retomada: false, avaliacao_id: 'av9', animal: 'Trovão da Serra',
      estado: 'PEDIR_LATERAL_ESQ', completo: false,
    })
    renderPage(<Morfologia />, { path: '/morfologia', route: '/morfologia' })

    await waitFor(() => expect(screen.getByText('Nenhuma avaliação ainda')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Começar uma avaliação/ }))
    await waitFor(() => expect(screen.getByText('Trovão da Serra')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Trovão da Serra'))

    await waitFor(() => expect(store.abrirAvaliacao).toHaveBeenCalledWith('a2'))
  })
})

describe('uma avaliação', () => {
  /*
    As nove pecas aparecem todas, inclusive as que faltam -- e com o nome que
    o banco deu. Se a tela montasse a lista, o roteiro existiria em dois
    lugares e mudaria num so.
  */
  it('mostra as nove peças do roteiro, inclusive as que faltam', async () => {
    store.getPainelAvaliacao.mockResolvedValue(painel())
    renderPage(<MorfologiaAvaliacao />, { path: '/morfologia/:id', route: '/morfologia/av1' })

    await waitFor(() => expect(screen.getByText('Manhosa do Kneip')).toBeInTheDocument())
    expect(screen.getByText('Foto do lado esquerdo')).toBeInTheDocument()
    expect(screen.getByText('Vídeo passando de lado')).toBeInTheDocument()
    expect(screen.getByText('Material — 0 de 9')).toBeInTheDocument()
  })

  /*
    O arquivo errado nao sobe.

    Mandar um video onde se pede foto e um engano comum, e o balde aceita ate
    100 MB. Subir para so depois descobrir que nao serve gastaria a rede do
    dono -- que muitas vezes esta no curral, no 4G -- por nada.
  */
  it('não envia arquivo que a validação recusa', async () => {
    store.getPainelAvaliacao.mockResolvedValue(painel())
    const { container } = renderPage(<MorfologiaAvaliacao />, {
      path: '/morfologia/:id',
      route: '/morfologia/av1',
    })
    await waitFor(() => expect(screen.getByText('Foto do lado esquerdo')).toBeInTheDocument())

    const entradas = container.querySelectorAll('input[type=file]')
    const video = new File(['x'], 'errado.mp4', { type: 'video/mp4' })
    await userEvent.upload(entradas[0] as HTMLInputElement, video)

    await waitFor(() => expect(store.enviarMidiaAvaliacao).not.toHaveBeenCalled())
  })

  it('envia o arquivo certo com o papel daquela peça', async () => {
    store.getPainelAvaliacao.mockResolvedValue(painel())
    store.enviarMidiaAvaliacao.mockResolvedValue({
      ok: true, midia_id: 'm1', papel: 'LATERAL_ESQ', rotulo: 'foto do lado esquerdo',
      validacao: 'ACEITA', substituiu: false, estado: 'PEDIR_LATERAL_DIR', completo: false,
    })
    const { container } = renderPage(<MorfologiaAvaliacao />, {
      path: '/morfologia/:id',
      route: '/morfologia/av1',
    })
    await waitFor(() => expect(screen.getByText('Foto do lado esquerdo')).toBeInTheDocument())

    const entradas = container.querySelectorAll('input[type=file]')
    await userEvent.upload(
      entradas[0] as HTMLInputElement,
      new File(['x'], 'lateral.jpg', { type: 'image/jpeg' }),
    )

    await waitFor(() =>
      expect(store.enviarMidiaAvaliacao).toHaveBeenCalledWith(
        expect.objectContaining({ papel: 'LATERAL_ESQ', avaliacaoId: 'av1', harasId: 'h1' }),
      ),
    )
  })

  /*
    Material completo tira os espacos de envio da tela e diz que pode ir
    embora: a analise leva minutos e roda no cron, nao no navegador aberto.
  */
  it('some com os envios e avisa que pode fechar a página quando o material fecha', async () => {
    store.getPainelAvaliacao.mockResolvedValue(
      painel({ estado: 'PROCESSANDO', completo: true }),
    )
    renderPage(<MorfologiaAvaliacao />, { path: '/morfologia/:id', route: '/morfologia/av1' })

    await waitFor(() => expect(screen.getByText('analisando as imagens')).toBeInTheDocument())
    expect(screen.queryByText('Foto do lado esquerdo')).not.toBeInTheDocument()
    expect(screen.getByText(/pode fechar a página/)).toBeInTheDocument()
  })

  it('mostra a nota e o laudo quando conclui', async () => {
    store.getPainelAvaliacao.mockResolvedValue(
      painel({
        estado: 'CONCLUIDA',
        completo: true,
        nota_geral: 7.5,
        confianca: 8,
        qualidade_material: 88,
        laudo: {
          caminho: 'h1/av1/laudo.pdf', arquivo: 'laudo.pdf', bytes: 3199,
          gerado_em: '2026-09-21T10:00:00Z',
        },
      }),
    )
    renderPage(<MorfologiaAvaliacao />, { path: '/morfologia/:id', route: '/morfologia/av1' })

    await waitFor(() => expect(screen.getByText('7,5')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Abrir o laudo em PDF/ })).toBeInTheDocument()
  })
})
