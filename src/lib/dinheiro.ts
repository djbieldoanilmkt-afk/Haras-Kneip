/**
 * Aritmética de dinheiro.
 *
 * Tudo aqui trabalha em centavos inteiros. Reais em `number` são ponto
 * flutuante binário, onde 0,1 + 0,2 não dá 0,3 — somar algumas dezenas de
 * lançamentos assim já desloca o fechamento do mês em centavos, e o gestor
 * perde a confiança no número inteiro por causa disso.
 */

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100)
}

export function paraReais(centavos: number): number {
  return centavos / 100
}

/**
 * Divide um valor entre N partes sem perder nem inventar centavo.
 *
 * O caso que motiva a função: R$ 1.200,00 entre 9 animais dá 133,333... por
 * cabeça. Arredondar cada parte para 133,33 devolve R$ 1.199,97 — some três
 * centavos, e o rateio deixa de fechar com a nota. Aqui o resto é distribuído
 * um centavo por vez entre as primeiras partes, então a soma é exata por
 * construção.
 *
 * As partes ficam em ordem decrescente (as primeiras recebem o centavo a
 * mais), o que é irrelevante para o total e mantém a função determinística.
 */
export function ratearCentavos(totalCentavos: number, quantidade: number): number[] {
  if (quantidade <= 0) return []

  const total = Math.round(totalCentavos)
  const base = Math.trunc(total / quantidade)
  // Math.trunc e não Math.floor: com total negativo, floor empurraria a base
  // para baixo e o resto ficaria positivo, invertendo a distribuição.
  const resto = total - base * quantidade
  const passo = Math.sign(resto)

  return Array.from({ length: quantidade }, (_, i) => base + (i < Math.abs(resto) ? passo : 0))
}
