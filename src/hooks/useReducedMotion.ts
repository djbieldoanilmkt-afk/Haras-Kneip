import { useSyncExternalStore } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * Verdadeiro quando o sistema operacional pede menos movimento.
 *
 * A regra em index.css cobre animação e transição declarativas. Este hook
 * cobre o que é dirigido por JavaScript — a contagem numérica e a revelação
 * ao rolar —, que aquela regra não alcança.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (aoMudar) => {
      const consulta = matchMedia(CONSULTA)
      consulta.addEventListener('change', aoMudar)
      return () => consulta.removeEventListener('change', aoMudar)
    },
    () => matchMedia(CONSULTA).matches,
    () => false,
  )
}
