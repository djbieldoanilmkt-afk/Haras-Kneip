import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const custos = vi.hoisted(() => vi.fn())
vi.mock('@/lib/store', () => ({ store: { getCustoPorCategoria: custos } }))

import { CustoPorCategoria } from './CustoPorCategoria'

/** Espera a resposta CHEGAR antes de afirmar que nada apareceu. */
async function esperarResposta() {
  await waitFor(() => expect(custos).toHaveBeenCalled())
  await act(async () => {})
}

beforeEach(() => vi.clearAllMocks())

describe('CustoPorCategoria', () => {
  it('mostra media por cabeca e total de cada categoria', async () => {
    custos.mockResolvedValue([
      { categoria: 'Égua', animais: 4, custoTotal: 1315, custoMedio: 328.75 },
      { categoria: 'Garanhão', animais: 4, custoTotal: 200, custoMedio: 50 },
    ])
    render(<CustoPorCategoria />)

    const egua = (await screen.findByText('Égua')).closest('li')
    /*
      A media por cabeca e o numero que responde "o que eu seguro e o que eu
      vendo"; o total sozinho engana quando as categorias tem tamanhos
      diferentes.

      Sem centavos de proposito: `formatBRL` arredonda no projeto inteiro
      ("no painel os centavos so poluem"). 328,75 vira 329.
    */
    expect(egua?.textContent).toContain('329')
    expect(egua?.textContent).toContain('1.315')
    expect(egua?.textContent).toContain('4 animais')
    expect(egua?.textContent).toContain('/cabeça')
  })

  it('diz "animal" no singular', async () => {
    custos.mockResolvedValue([
      { categoria: 'Potra', animais: 1, custoTotal: 0, custoMedio: 0 },
    ])
    render(<CustoPorCategoria />)
    const linha = (await screen.findByText('Potra')).closest('li')
    expect(linha?.textContent).toContain('1 animal')
    expect(linha?.textContent).not.toContain('1 animais')
  })

  it('some inteiro para quem nao ve financeiro, em vez de mostrar zeros', async () => {
    // A funcao do banco devolve vazio para peao. Um quadro zerado pareceria
    // que o haras nao gastou nada -- pior que ausente.
    custos.mockResolvedValue([])
    render(<CustoPorCategoria />)
    await esperarResposta()
    expect(screen.queryByText('Custo por categoria')).toBeNull()
  })

  it('some quando a consulta falha, sem derrubar a pagina', async () => {
    custos.mockRejectedValue(new Error('sem permissão'))
    render(<CustoPorCategoria />)
    await esperarResposta()
    expect(screen.queryByText('Custo por categoria')).toBeNull()
  })
})
