/*
  Texto para o laudo em PDF.

  O PDF é desenhado ponto a ponto: não existe "deixa o navegador quebrar a
  linha". Quem quebra somos nós, e se errarmos a conta o texto sai pela margem
  e SOME do documento — não aparece cortado, simplesmente não está lá.

  Puro de propósito: o medidor entra como parâmetro, então o teste roda sem
  pdf-lib, sem fonte e sem PDF nenhum.
*/

/**
 * Parte um texto em linhas que cabem em `larguraMax`.
 *
 * @param medir  quanto uma string ocupa — no PDF, `fonte.widthOfTextAtSize`
 * @returns as linhas; string vazia representa um parágrafo em branco
 */
export function quebrarTexto(
  texto: string,
  larguraMax: number,
  medir: (s: string) => number,
): string[] {
  if (!texto || !String(texto).trim()) return []

  const linhas: string[] = []

  for (const paragrafo of String(texto).split(/\n/)) {
    if (!paragrafo.trim()) {
      /* Linha em branco entre parágrafos é intencional; espaço duplicado no
         meio de uma frase não é. */
      if (linhas.length > 0) linhas.push('')
      continue
    }

    let atual = ''
    for (const palavra of paragrafo.trim().split(/\s+/)) {
      /*
        A palavra sozinha não cabe: fecha o que estava escrito e parte ela.

        A conferência vem ANTES de tentar emendar na linha atual — de outro
        jeito, uma palavra gigante no meio da frase escaparia para a linha
        seguinte inteira e vazaria pela margem.
      */
      if (medir(palavra) > larguraMax) {
        if (atual) {
          linhas.push(atual)
          atual = ''
        }
        let pedaco = ''
        for (const letra of palavra) {
          if (pedaco && medir(pedaco + letra) > larguraMax) {
            linhas.push(pedaco)
            pedaco = letra
          } else {
            pedaco += letra
          }
        }
        atual = pedaco
        continue
      }

      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (medir(tentativa) <= larguraMax) {
        atual = tentativa
      } else {
        linhas.push(atual)
        atual = palavra
      }
    }
    if (atual) linhas.push(atual)
  }

  return linhas
}

/** Nota como se escreve em português: uma casa, vírgula. */
export function nota(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(1).replace('.', ',')
}

/** Valor em real, com o ponto de milhar no lugar certo. */
export function dinheiro(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/*
  Deixa o texto no que a fonte padrão do PDF sabe escrever.

  A `Helvetica` do pdf-lib usa codificação WinAnsi. Acento do português está
  lá; aspa curva, travessão e emoji não estão — e a biblioteca não ignora o que
  não conhece, ela ESTOURA. Sem esta limpeza, um laudo inteiro se perde porque
  o modelo escreveu com aspas bonitas.

  O que tem equivalente vira equivalente; o resto some. Sumir é melhor que um
  losango de caractere desconhecido no meio de um parecer.
*/
const TROCAS: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-',
  '\u2022': '-', '\u00A0': ' ', '\u2026': '...',
  '\u00AD': '',
}

export function limparParaPdf(texto: string): string {
  return String(texto ?? '')
    .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2013\u2014\u2212\u2022\u00A0\u2026\u00AD]/g,
             (c) => TROCAS[c] ?? '')
    .replace(/[^\n\r\t\u0020-\u00FF]/g, '')
}
