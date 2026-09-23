import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContadorAnimado } from './useContadorAnimado'

const mockReduced = vi.fn(() => false)
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => mockReduced() }))

beforeEach(() => {
  mockReduced.mockReturnValue(false)
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
})

afterEach(() => vi.useRealTimers())

describe('useContadorAnimado', () => {
  it('comeca em zero', () => {
    const { result } = renderHook(() => useContadorAnimado(50))
    expect(result.current).toBe(0)
  })

  it('chega ao valor final ao fim do tempo', () => {
    const { result } = renderHook(() => useContadorAnimado(50, 800))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(50)
  })

  it('nunca ultrapassa o valor final durante a contagem', () => {
    const { result } = renderHook(() => useContadorAnimado(7, 800))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBeLessThanOrEqual(7)
    expect(result.current).toBeGreaterThanOrEqual(0)
  })

  it('vai direto ao valor final quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    const { result } = renderHook(() => useContadorAnimado(50, 800))
    expect(result.current).toBe(50)
  })

  it('devolve zero quando o valor final e zero', () => {
    const { result } = renderHook(() => useContadorAnimado(0, 800))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(0)
  })

  it('reconta quando o valor muda', () => {
    const { result, rerender } = renderHook(({ v }) => useContadorAnimado(v, 800), {
      initialProps: { v: 10 },
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(10)

    rerender({ v: 25 })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(25)
  })
})
