import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'haras-theme'

/**
 * Tema claro/escuro com preferência persistida.
 *
 * O estado vive no localStorage, não em useState, e é lido por
 * useSyncExternalStore. Isso faz todos os consumidores do hook enxergarem o
 * mesmo valor: a topbar, o Toaster e qualquer outro componente reagem juntos
 * ao mesmo clique, sem precisar de um provider embrulhando a árvore.
 */

const ouvintes = new Set<() => void>()

function subscribe(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

function getSnapshot(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

function aplicar(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function definir(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  aplicar(theme)
  for (const ouvinte of ouvintes) ouvinte()
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as Theme)

  useEffect(() => {
    aplicar(theme)
  }, [theme])

  const toggle = useCallback(() => {
    definir(getSnapshot() === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, toggle }
}
