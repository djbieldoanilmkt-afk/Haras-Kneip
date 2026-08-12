import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, calcularIdade } from './format'

describe('formatDate', () => {
  it('formata data ISO no padrao brasileiro', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024')
  })

  it('devolve string vazia quando nao ha data', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
})

describe('calcularIdade', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function em(data: string) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(data))
  }

  it('devolve Desconhecida quando nao ha data de nascimento', () => {
    expect(calcularIdade(null)).toBe('Desconhecida')
  })

  it('devolve so meses quando tem menos de um ano', () => {
    em('2026-08-11T12:00:00Z')
    expect(calcularIdade('2026-05-11')).toBe('3 meses')
  })

  it('usa singular para um mes', () => {
    em('2026-08-11T12:00:00Z')
    expect(calcularIdade('2026-07-11')).toBe('1 mês')
  })

  it('devolve anos e meses', () => {
    em('2026-08-11T12:00:00Z')
    expect(calcularIdade('2020-05-11')).toBe('6 anos e 3 meses')
  })

  it('usa singular para um ano', () => {
    em('2026-08-11T12:00:00Z')
    expect(calcularIdade('2025-08-11')).toBe('1 ano e 0 meses')
  })

  it('nao conta o ano quando o aniversario ainda nao chegou', () => {
    em('2026-08-11T12:00:00Z')
    expect(calcularIdade('2025-12-25')).toBe('7 meses')
  })
})
