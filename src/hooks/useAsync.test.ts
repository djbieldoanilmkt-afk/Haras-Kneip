import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('comeca carregando e entrega os dados', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeNull()
  })

  it('captura erro sem lancar', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('falhou')), []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('falhou')
    expect(result.current.data).toBeNull()
  })

  it('reexecuta quando reload e chamado', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsync(fn, []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fn).toHaveBeenCalledTimes(1)

    act(() => result.current.reload())
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2))
  })

  it('limpa o erro anterior numa recarga bem sucedida', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('primeira falhou'))
      .mockResolvedValueOnce('agora vai')

    const { result } = renderHook(() => useAsync(fn, []))

    await waitFor(() => expect(result.current.error?.message).toBe('primeira falhou'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe('agora vai'))
    expect(result.current.error).toBeNull()
  })
})
