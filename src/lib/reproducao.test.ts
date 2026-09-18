import { describe, it, expect } from 'vitest'

import { COBERTURA, DIAGNOSTICO, coberturasPorGaranhao, taxaDeDiagnostico } from './reproducao'

describe('taxaDeDiagnostico', () => {
  it('conta diagnosticos positivos sobre coberturas', () => {
    const taxa = taxaDeDiagnostico([
      { tipo: COBERTURA },
      { tipo: COBERTURA },
      { tipo: COBERTURA },
      { tipo: COBERTURA },
      { tipo: DIAGNOSTICO },
      { tipo: DIAGNOSTICO },
      { tipo: DIAGNOSTICO },
    ])

    expect(taxa).toEqual({ coberturas: 4, diagnosticos: 3, percentual: 75 })
  })

  it('devolve zero por cento sem cobertura, em vez de dividir por zero', () => {
    const taxa = taxaDeDiagnostico([{ tipo: DIAGNOSTICO }])

    expect(taxa.coberturas).toBe(0)
    expect(taxa.percentual).toBe(0)
    expect(Number.isFinite(taxa.percentual)).toBe(true)
  })

  it('ignora parto e cio na conta', () => {
    const taxa = taxaDeDiagnostico([
      { tipo: COBERTURA },
      { tipo: 'Parto' },
      { tipo: 'Cio' },
      { tipo: DIAGNOSTICO },
    ])

    expect(taxa).toEqual({ coberturas: 1, diagnosticos: 1, percentual: 100 })
  })
})

describe('coberturasPorGaranhao', () => {
  it('conta so eventos de cobertura, do mais usado para o menos', () => {
    const ranking = coberturasPorGaranhao([
      { tipo: COBERTURA, garanhao: 'Imperador' },
      { tipo: COBERTURA, garanhao: 'Imperador' },
      { tipo: COBERTURA, garanhao: 'Trovão' },
    ])

    expect(ranking).toEqual([
      { garanhao: 'Imperador', coberturas: 2 },
      { garanhao: 'Trovão', coberturas: 1 },
    ])
  })

  it('nao conta o garanhao que aparece em parto ou diagnostico', () => {
    // O campo garanhao existe em qualquer linha; somar todas contaria o mesmo
    // serviço três vezes.
    const ranking = coberturasPorGaranhao([
      { tipo: COBERTURA, garanhao: 'Imperador' },
      { tipo: DIAGNOSTICO, garanhao: 'Imperador' },
      { tipo: 'Parto', garanhao: 'Imperador' },
    ])

    expect(ranking).toEqual([{ garanhao: 'Imperador', coberturas: 1 }])
  })

  it('deixa de fora cobertura sem garanhao informado', () => {
    const ranking = coberturasPorGaranhao([
      { tipo: COBERTURA, garanhao: null },
      { tipo: COBERTURA, garanhao: '   ' },
      { tipo: COBERTURA, garanhao: 'Trovão' },
    ])

    expect(ranking).toEqual([{ garanhao: 'Trovão', coberturas: 1 }])
  })

  it('desempata por nome, para a ordem nao variar entre carregamentos', () => {
    const ranking = coberturasPorGaranhao([
      { tipo: COBERTURA, garanhao: 'Vendaval' },
      { tipo: COBERTURA, garanhao: 'Imperador' },
    ])

    expect(ranking.map((g) => g.garanhao)).toEqual(['Imperador', 'Vendaval'])
  })
})
