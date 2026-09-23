import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { PainelVideo } from './PainelVideo'

const menosMovimento = vi.hoisted(() => ({ valor: false }))
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => menosMovimento.valor,
}))

/**
 * O jsdom não implementa reprodução de mídia; `play` seria undefined e o
 * componente quebraria. Aqui ele vira função resolvida, e `currentSrc` passa a
 * refletir o src — o componente usa isso para decidir se pode tocar.
 */
beforeEach(() => {
  menosMovimento.valor = false
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, 'currentSrc', {
    configurable: true,
    get() {
      return this.getAttribute('src') ?? ''
    },
  })
})

const videos = (c: HTMLElement) => [...c.querySelectorAll('video')]
const opacidade = (v: HTMLVideoElement) => (v.className.includes('opacity-100') ? 1 : 0)

describe('PainelVideo', () => {
  it('carrega so o primeiro clipe de inicio', () => {
    const { container } = render(<PainelVideo />)
    const [a, b] = videos(container)

    expect(a).toHaveAttribute('src', 'assets/haras-drone.webm')
    expect(b).not.toHaveAttribute('src')
  })

  it('libera o segundo quando o primeiro tem dados', () => {
    const { container } = render(<PainelVideo />)
    fireEvent.loadedData(videos(container)[0])

    expect(videos(container)[1]).toHaveAttribute('src', 'assets/mangalarga-drone.webm')
  })

  it('passa a vez ao segundo quando o primeiro termina', () => {
    const { container } = render(<PainelVideo />)
    fireEvent.loadedData(videos(container)[0])
    fireEvent.ended(videos(container)[0])

    const [a, b] = videos(container)
    expect(opacidade(a)).toBe(0)
    expect(opacidade(b)).toBe(1)
  })

  it('volta ao primeiro quando o segundo termina, fechando o ciclo', () => {
    const { container } = render(<PainelVideo />)
    fireEvent.loadedData(videos(container)[0])
    fireEvent.ended(videos(container)[0])
    fireEvent.ended(videos(container)[1])

    expect(opacidade(videos(container)[0])).toBe(1)
  })

  it('nao apaga o painel se o segundo ainda nao carregou', () => {
    const { container } = render(<PainelVideo />)
    // Sem loadedData: o segundo continua sem src.
    fireEvent.ended(videos(container)[0])

    const [a, b] = videos(container)
    expect(opacidade(a)).toBe(1)
    expect(b).not.toHaveAttribute('src')
  })

  it('mostra so o poster quando o sistema pede menos movimento', () => {
    menosMovimento.valor = true
    const { container } = render(<PainelVideo />)

    expect(videos(container)).toHaveLength(0)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'assets/haras-drone-poster.webp',
    )
  })

  it('cai para o poster quando o video falha', () => {
    const { container } = render(<PainelVideo />)
    fireEvent.error(videos(container)[0])

    expect(videos(container)).toHaveLength(0)
    expect(container.querySelector('img')).toBeInTheDocument()
  })
})
