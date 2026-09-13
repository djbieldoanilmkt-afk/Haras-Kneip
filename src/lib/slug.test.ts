import { describe, it, expect } from 'vitest'
import { gerarSlug, validarSlug } from './slug'

describe('gerarSlug', () => {
  it('converte nome simples', () => {
    expect(gerarSlug('Haras Kneip')).toBe('haras-kneip')
  })

  it('remove acentos', () => {
    expect(gerarSlug('Haras São João da Serra')).toBe('haras-sao-joao-da-serra')
  })

  it('trata apostrofos e pontuacao', () => {
    expect(gerarSlug("Fazenda D'Água Ltda.")).toBe('fazenda-d-agua-ltda')
  })

  it('colapsa espacos e hifens repetidos', () => {
    expect(gerarSlug('Haras  --  Duplo')).toBe('haras-duplo')
  })

  it('remove hifens das pontas', () => {
    expect(gerarSlug(' - Haras da Ponta - ')).toBe('haras-da-ponta')
  })

  it('devolve vazio para entrada sem conteudo aproveitavel', () => {
    expect(gerarSlug('!!!')).toBe('')
  })
})

describe('validarSlug', () => {
  it('aceita slug bem formado', () => {
    expect(validarSlug('haras-kneip').valido).toBe(true)
  })

  it('rejeita maiusculas, espacos e acentos', () => {
    expect(validarSlug('Haras Kneip').valido).toBe(false)
    expect(validarSlug('haras kneip').valido).toBe(false)
    expect(validarSlug('são-joão').valido).toBe(false)
  })

  it('rejeita hifens nas pontas ou duplicados', () => {
    expect(validarSlug('-haras').valido).toBe(false)
    expect(validarSlug('haras-').valido).toBe(false)
    expect(validarSlug('haras--kneip').valido).toBe(false)
  })

  it('exige entre 3 e 40 caracteres', () => {
    expect(validarSlug('ab').valido).toBe(false)
    expect(validarSlug('a'.repeat(41)).valido).toBe(false)
    expect(validarSlug('abc').valido).toBe(true)
  })

  it('explica o motivo quando invalido', () => {
    expect(validarSlug('ab').motivo).toMatch(/3/)
    expect(validarSlug('Haras').motivo).toBeTruthy()
  })
})
