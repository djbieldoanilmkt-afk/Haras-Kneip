import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function mockMatchMedia(matches: boolean) {
  const ouvintes = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: (_: string, l: () => void) => ouvintes.add(l),
      removeEventListener: (_: string, l: () => void) => ouvintes.delete(l),
    })),
  )
  return ouvintes
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('useReducedMotion', () => {
  it('devolve false quando o sistema nao pede menos movimento', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('devolve true quando o sistema pede menos movimento', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('consulta a media query correta', () => {
    mockMatchMedia(false)
    renderHook(() => useReducedMotion())
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('assina e cancela a assinatura da media query', () => {
    const ouvintes = mockMatchMedia(false)
    const { unmount } = renderHook(() => useReducedMotion())
    expect(ouvintes.size).toBe(1)
    unmount()
    expect(ouvintes.size).toBe(0)
  })
})
