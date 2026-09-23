import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('comeca no tema claro quando nao ha preferencia salva', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('le a preferencia salva', () => {
    localStorage.setItem('haras-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('alterna e persiste', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggle())

    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('haras-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('volta para o claro ao alternar de novo', () => {
    localStorage.setItem('haras-theme', 'dark')
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggle())

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
