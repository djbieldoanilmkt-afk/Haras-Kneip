import { describe, it, expect } from 'vitest'

import { paraCentavos, paraReais, ratearCentavos } from './dinheiro'

describe('ratearCentavos', () => {
  it('soma exatamente o total quando a divisao nao e inteira', () => {
    // R$ 1.200,00 entre 9 animais: 133,33 por cabeça perderia 3 centavos.
    const partes = ratearCentavos(120_000, 9)

    expect(partes).toHaveLength(9)
    expect(partes.reduce((s, p) => s + p, 0)).toBe(120_000)
  })

  it('distribui o resto um centavo por vez, sem parte destoante', () => {
    const partes = ratearCentavos(100, 3)

    expect(partes).toEqual([34, 33, 33])
    expect(Math.max(...partes) - Math.min(...partes)).toBe(1)
  })

  it('divide igualmente quando a divisao e exata', () => {
    expect(ratearCentavos(90_000, 3)).toEqual([30_000, 30_000, 30_000])
  })

  it('devolve o total inteiro para um unico animal', () => {
    expect(ratearCentavos(12_345, 1)).toEqual([12_345])
  })

  it('devolve lista vazia quando nao ha animais, em vez de dividir por zero', () => {
    expect(ratearCentavos(1000, 0)).toEqual([])
    expect(ratearCentavos(1000, -2)).toEqual([])
  })

  it('mantem a soma exata tambem com valor negativo (estorno)', () => {
    const partes = ratearCentavos(-100, 3)

    expect(partes.reduce((s, p) => s + p, 0)).toBe(-100)
    expect(partes).toEqual([-34, -33, -33])
  })

  it('fecha a soma para qualquer combinacao de valor e quantidade', () => {
    for (let total = 0; total <= 500; total += 7) {
      for (let n = 1; n <= 12; n++) {
        expect(ratearCentavos(total, n).reduce((s, p) => s + p, 0)).toBe(total)
      }
    }
  })
})

describe('conversao', () => {
  it('arredonda para o centavo mais proximo', () => {
    expect(paraCentavos(133.334)).toBe(13_333)
    expect(paraCentavos(133.336)).toBe(13_334)
  })

  it('sobrevive a valores que o ponto flutuante representa mal', () => {
    // 0,1 + 0,2 === 0.30000000000000004 em ponto flutuante.
    expect(paraCentavos(0.1 + 0.2)).toBe(30)
  })

  it('faz a volta sem perder valor', () => {
    expect(paraReais(paraCentavos(1234.56))).toBe(1234.56)
  })
})
