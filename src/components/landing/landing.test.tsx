import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * O IntersectionObserver do jsdom (e o do navegador com a aba sem pintura)
 * nunca dispara, então o gatilho de revelação é forçado aqui. O que estes
 * testes cobrem é o que acontece DEPOIS de revelar — que é onde mora a lógica.
 */
const revelado = vi.hoisted(() => ({ valor: true }))
vi.mock('@/hooks/useRevelarAoRolar', () => ({
  useRevelarAoRolar: () => ({ ref: { current: null }, revelado: revelado.valor }),
}))

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

import { SecaoGenealogia } from './SecaoGenealogia'
import { SecaoWhatsApp } from './SecaoWhatsApp'
import { ContadorReal } from './ContadorReal'

beforeEach(() => {
  revelado.valor = true
  rpc.mockReset()
})

describe('SecaoGenealogia', () => {
  it('monta a arvore real com conectores quando revelada', () => {
    render(
      <MemoryRouter>
        <SecaoGenealogia />
      </MemoryRouter>,
    )
    expect(document.querySelector('.pedigree')).toBeInTheDocument()
    expect(document.querySelectorAll('.pedigree-no')).toHaveLength(7)
    expect(screen.getByText('Imperador do Vale')).toBeInTheDocument()
  })

  it('nao cria links para o app protegido', () => {
    render(
      <MemoryRouter>
        <SecaoGenealogia />
      </MemoryRouter>,
    )
    expect(document.querySelectorAll('.pedigree a')).toHaveLength(0)
  })

  it('reserva a altura antes de revelar, para a pagina nao pular', () => {
    revelado.valor = false
    render(
      <MemoryRouter>
        <SecaoGenealogia />
      </MemoryRouter>,
    )
    expect(document.querySelector('.pedigree')).not.toBeInTheDocument()
    expect(document.querySelector('.h-\\[19rem\\]')).toBeInTheDocument()
  })
})

describe('SecaoWhatsApp', () => {
  it('deixa claro que o recurso ainda nao existe', () => {
    render(<SecaoWhatsApp />)
    expect(screen.getByText('Em breve')).toBeInTheDocument()
  })

  it('encena a conversa ate a confirmacao da despesa', async () => {
    vi.useFakeTimers()
    render(<SecaoWhatsApp />)

    await act(async () => {
      vi.advanceTimersByTime(4200)
    })

    expect(screen.getByText(/oito sacas de ração/)).toBeInTheDocument()
    expect(screen.getByText('Despesa registrada?')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.200,00')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('ContadorReal', () => {
  it('mostra os numeros vindos do banco, ao fim da contagem', async () => {
    rpc.mockResolvedValue({ data: { animais: 1234, haras: 42 }, error: null })
    render(<ContadorReal />)

    await waitFor(() => expect(screen.getByText('Animais cadastrados')).toBeInTheDocument())

    // A contagem dura 1200ms — mais que o limite padrao do waitFor.
    await waitFor(() => expect(screen.getByText('1.234')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('some quando a consulta falha, em vez de mostrar zero', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('sem rede') })
    const { container } = render(<ContadorReal />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('some enquanto o numero for pequeno demais para vender', async () => {
    rpc.mockResolvedValue({ data: { animais: 3, haras: 1 }, error: null })
    const { container } = render(<ContadorReal />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
