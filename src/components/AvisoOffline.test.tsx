import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { AvisoOffline } from './AvisoOffline'

/** Finge o estado da conexão e devolve a função que desfaz. */
function fingirConexao(online: boolean) {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
  return () => {
    if (original) Object.defineProperty(window.navigator, 'onLine', original)
  }
}

let desfazer: (() => void) | null = null
afterEach(() => {
  desfazer?.()
  desfazer = null
  vi.restoreAllMocks()
})

describe('AvisoOffline', () => {
  it('nao aparece com conexao', () => {
    desfazer = fingirConexao(true)
    render(<AvisoOffline />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('avisa que o dado pode estar velho quando cai a conexao', () => {
    desfazer = fingirConexao(false)
    render(<AvisoOffline />)

    const aviso = screen.getByRole('status')
    // O texto e o motivo do componente existir: sem ele, o plantel de ontem
    // aparece com cara de plantel de hoje e quem confere uma vacina acredita.
    expect(aviso.textContent).toContain('Sem conexão')
    expect(aviso.textContent).toContain('últimos dados carregados')
  })

  it('some sozinho quando a conexao volta', () => {
    desfazer = fingirConexao(false)
    render(<AvisoOffline />)
    expect(screen.getByRole('status')).toBeTruthy()

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('aparece sozinho quando a conexao cai com a tela aberta', () => {
    desfazer = fingirConexao(true)
    render(<AvisoOffline />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('para de escutar ao sair da tela', () => {
    desfazer = fingirConexao(true)
    const remover = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<AvisoOffline />)
    unmount()

    const eventos = remover.mock.calls.map((c) => c[0])
    expect(eventos).toContain('online')
    expect(eventos).toContain('offline')
  })
})
