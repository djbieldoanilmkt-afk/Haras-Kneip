import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRevelarAoRolar } from './useRevelarAoRolar'

const mockReduced = vi.fn(() => false)
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => mockReduced() }))

let instancias: { observados: Element[]; desconectado: boolean }[] = []

beforeEach(() => {
  mockReduced.mockReturnValue(false)
  instancias = []

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      estado = { observados: [] as Element[], desconectado: false }
      constructor() {
        instancias.push(this.estado)
      }
      observe(el: Element) {
        this.estado.observados.push(el)
      }
      unobserve() {}
      disconnect() {
        this.estado.desconectado = true
      }
    },
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('useRevelarAoRolar', () => {
  it('devolve uma ref e comeca escondido', () => {
    const { result } = renderHook(() => useRevelarAoRolar())
    expect(result.current.revelado).toBe(false)
    expect(result.current.ref).toHaveProperty('current')
  })

  it('ja comeca revelado quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    const { result } = renderHook(() => useRevelarAoRolar())
    expect(result.current.revelado).toBe(true)
  })

  it('nao cria observer quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    renderHook(() => useRevelarAoRolar())
    expect(instancias).toHaveLength(0)
  })

  it('desconecta o observer ao desmontar', () => {
    const { unmount } = renderHook(() => {
      const r = useRevelarAoRolar<HTMLDivElement>()
      // Simula o elemento ja montado para o efeito encontrar a ref preenchida.
      if (!r.ref.current) r.ref.current = document.createElement('div')
      return r
    })
    expect(instancias).toHaveLength(1)
    unmount()
    expect(instancias[0].desconectado).toBe(true)
  })
})
