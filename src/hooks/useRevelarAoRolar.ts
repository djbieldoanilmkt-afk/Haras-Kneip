import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from './useReducedMotion'

/**
 * Revela um elemento quando ele entra na tela.
 *
 * Revela uma única vez: sair da tela não desfaz. Sem isso o conteúdo pisca ao
 * rolar para cima e para baixo, o que cansa numa lista longa.
 */
export function useRevelarAoRolar<T extends HTMLElement = HTMLDivElement>() {
  const menosMovimento = useReducedMotion()
  const ref = useRef<T>(null)
  const [revelado, setRevelado] = useState(menosMovimento)

  useEffect(() => {
    if (menosMovimento) {
      setRevelado(true)
      return
    }

    const elemento = ref.current
    if (!elemento) return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setRevelado(true)
            observador.disconnect()
          }
        }
      },
      // Exige que o elemento entre um pouco na tela antes de revelar, para o
      // movimento nao acontecer na borda inferior, onde quase nao se ve.
      { rootMargin: '0px 0px -10% 0px' },
    )

    observador.observe(elemento)
    return () => observador.disconnect()
  }, [menosMovimento])

  return { ref, revelado }
}
