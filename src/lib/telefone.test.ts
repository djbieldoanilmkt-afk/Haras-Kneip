import { describe, it, expect } from 'vitest'

import { formatarTelefone, normalizarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  it('reduz as varias formas de escrever o mesmo numero a uma so', () => {
    const formas = [
      '(31) 99999-8888',
      '31999998888',
      '+55 31 99999-8888',
      '5531999998888',
      ' 31 9 9999 8888 ',
    ]

    for (const forma of formas) {
      expect(normalizarTelefone(forma)).toBe('+5531999998888')
    }
  })

  it('aceita telefone fixo da sede', () => {
    expect(normalizarTelefone('(31) 3379-6100')).toBe('+553133796100')
  })

  it('recusa numero curto demais ou longo demais', () => {
    expect(normalizarTelefone('99998888')).toBeNull()
    expect(normalizarTelefone('319999988889999')).toBeNull()
  })

  it('recusa DDD que nao existe', () => {
    // Não há DDD abaixo de 11 no Brasil.
    expect(normalizarTelefone('01999998888')).toBeNull()
    expect(normalizarTelefone('10999998888')).toBeNull()
  })

  it('recusa celular de 11 digitos que nao comeca com 9', () => {
    expect(normalizarTelefone('31899998888')).toBeNull()
  })

  it('recusa fixo que comeca com digito de celular', () => {
    expect(normalizarTelefone('3199998888')).toBeNull()
  })

  it('devolve null para vazio, nulo e texto', () => {
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone(null)).toBeNull()
    expect(normalizarTelefone(undefined)).toBeNull()
    expect(normalizarTelefone('meu zap')).toBeNull()
  })

  it('e idempotente: normalizar o que ja esta normalizado nao muda nada', () => {
    const uma = normalizarTelefone('(31) 99999-8888')
    expect(normalizarTelefone(uma)).toBe(uma)
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo para leitura', () => {
    expect(formatarTelefone('+5531999998888')).toBe('(31) 99999-8888')
    expect(formatarTelefone('+553133796100')).toBe('(31) 3379-6100')
  })

  it('devolve vazio quando nao ha telefone', () => {
    expect(formatarTelefone(null)).toBe('')
    expect(formatarTelefone('')).toBe('')
  })

  it('devolve o valor cru quando nao reconhece o formato, em vez de mentir', () => {
    expect(formatarTelefone('+12125551234')).toBe('+12125551234')
  })
})
