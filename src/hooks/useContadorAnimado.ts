import { useEffect, useState } from 'react'

import { useReducedMotion } from './useReducedMotion'

/** Desaceleração cúbica: rápido no início, suave no fim. */
function desacelerar(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Conta de zero até `valor` no tempo informado.
 *
 * Vai direto ao valor final quando o sistema pede menos movimento — este é o
 * caminho que a regra CSS de `prefers-reduced-motion` não alcança, porque a
 * contagem acontece em JavaScript.
 */
export function useContadorAnimado(valor: number, duracao = 800): number {
  const menosMovimento = useReducedMotion()
  const [atual, setAtual] = useState(menosMovimento ? valor : 0)

  useEffect(() => {
    if (menosMovimento) {
      setAtual(valor)
      return
    }

    let quadro = 0
    let inicio: number | null = null

    const passo = (agora: number) => {
      inicio ??= agora
      const progresso = Math.min((agora - inicio) / duracao, 1)
      setAtual(Math.round(desacelerar(progresso) * valor))
      if (progresso < 1) quadro = requestAnimationFrame(passo)
    }

    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, duracao, menosMovimento])

  return atual
}
