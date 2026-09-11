import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const restaurar = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listar = vi.hoisted(() => vi.fn())

vi.mock('@/lib/store', () => ({ store: { getLixeira: listar, restaurarRegistro: restaurar } }))
const aviso = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: aviso }))

import { SecaoLixeira } from './SecaoLixeira'

const ITEM = {
  tabela: 'saude_registros' as const,
  id: 's1',
  descricao: 'Vacinação — Aurora',
  quando: '2026-09-01',
  excluido_em: '2026-09-10T14:30:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  listar.mockResolvedValue([ITEM])
  restaurar.mockResolvedValue(undefined)
})

describe('SecaoLixeira', () => {
  it('mostra o que foi excluido, de onde veio e quando', async () => {
    render(<SecaoLixeira />)

    expect(await screen.findByText('Vacinação — Aurora')).toBeInTheDocument()
    // Sem o rotulo da origem, "Vacinacao — Aurora" nao diz de que tela veio.
    const linha = screen.getByText('Vacinação — Aurora').closest('li')
    expect(linha?.textContent).toContain('Sanidade')
    expect(linha?.textContent).toContain('excluído')
  })

  it('restaura e recarrega a lista', async () => {
    const usuario = userEvent.setup()
    render(<SecaoLixeira />)
    await screen.findByText('Vacinação — Aurora')

    // Na segunda leitura a lixeira volta vazia, como o banco faria.
    listar.mockResolvedValue([])
    await usuario.click(screen.getByRole('button', { name: /Restaurar Vacinação/ }))

    expect(restaurar).toHaveBeenCalledWith('saude_registros', 's1')
    await waitFor(() => expect(screen.getByText(/Nada excluído/)).toBeInTheDocument())
  })

  it('avisa do erro quando o servidor recusa restaurar', async () => {
    const usuario = userEvent.setup()
    restaurar.mockRejectedValue(new Error('sem permissão'))
    render(<SecaoLixeira />)
    await screen.findByText('Vacinação — Aurora')

    await usuario.click(screen.getByRole('button', { name: /Restaurar Vacinação/ }))

    // Falhar em silencio seria mentir duas vezes: o registro continua
    // excluido e a pessoa acharia que resolveu. A mensagem carrega o motivo.
    await waitFor(() =>
      expect(aviso.error).toHaveBeenCalledWith(expect.stringContaining('sem permissão')),
    )
    expect(aviso.success).not.toHaveBeenCalled()
    expect(screen.getByText('Vacinação — Aurora')).toBeInTheDocument()
  })

  it('diz que esta vazia em vez de mostrar lista em branco', async () => {
    listar.mockResolvedValue([])
    render(<SecaoLixeira />)
    expect(await screen.findByText(/Nada excluído/)).toBeInTheDocument()
  })
})
