import { describe, it, expect } from 'vitest'
import { validateAnimal, validateEvento, validateSaude, validateReproducao } from './validators'

describe('validateAnimal', () => {
  it('aceita animal com nome e raca', () => {
    const r = validateAnimal({ nome: 'Aurora da Kneip', raca: 'Mangalarga Marchador' })
    expect(r.isValid).toBe(true)
    expect(r.errors).toEqual({})
  })

  it('rejeita nome ausente', () => {
    const r = validateAnimal({ nome: '', raca: 'Mangalarga Marchador' })
    expect(r.isValid).toBe(false)
    expect(r.errors.nome).toBe('Nome é obrigatório')
  })

  it('rejeita raca ausente', () => {
    const r = validateAnimal({ nome: 'Aurora', raca: '' })
    expect(r.isValid).toBe(false)
    expect(r.errors.raca).toBe('Raça é obrigatória')
  })

  it('acumula os dois erros', () => {
    const r = validateAnimal({ nome: '', raca: '' })
    expect(Object.keys(r.errors)).toHaveLength(2)
  })

  it('rejeita nome so com espacos', () => {
    const r = validateAnimal({ nome: '   ', raca: 'Mangalarga Marchador' })
    expect(r.isValid).toBe(false)
  })
})

describe('validateEvento', () => {
  it('aceita evento com titulo e data', () => {
    expect(validateEvento({ titulo: 'Vacinação', data_evento: '2026-08-11' }).isValid).toBe(true)
  })

  it('rejeita titulo ausente', () => {
    expect(validateEvento({ titulo: '', data_evento: '2026-08-11' }).errors.titulo).toBe(
      'Título é obrigatório',
    )
  })

  it('rejeita data ausente', () => {
    expect(validateEvento({ titulo: 'Vacinação', data_evento: '' }).errors.data_evento).toBe(
      'Data é obrigatória',
    )
  })
})

describe('validateSaude', () => {
  it('aceita registro com tipo e data', () => {
    expect(validateSaude({ tipo: 'Vacina', data_registro: '2026-08-11' }).isValid).toBe(true)
  })

  it('rejeita tipo ausente', () => {
    expect(validateSaude({ tipo: '', data_registro: '2026-08-11' }).errors.tipo).toBe(
      'Tipo é obrigatório',
    )
  })
})

describe('validateReproducao', () => {
  it('aceita evento com tipo e data', () => {
    expect(validateReproducao({ tipo: 'Parto', data_evento: '2026-08-11' }).isValid).toBe(true)
  })

  it('rejeita data ausente', () => {
    expect(validateReproducao({ tipo: 'Parto', data_evento: '' }).errors.data_evento).toBe(
      'Data é obrigatória',
    )
  })
})
