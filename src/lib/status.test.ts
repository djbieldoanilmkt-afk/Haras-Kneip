import { describe, it, expect } from 'vitest'
import { statusClasses, STATUS_REPRODUTIVO, PELAGENS, TIPOS_MARCHA, TIPOS_EVENTO } from './status'

describe('statusClasses', () => {
  it('mapeia status conhecidos sem diferenciar maiusculas', () => {
    expect(statusClasses('Prenha')).toBe('bg-status-prenha/12 text-status-prenha')
    expect(statusClasses('prenha')).toBe('bg-status-prenha/12 text-status-prenha')
  })

  it('mapeia Em Cobertura', () => {
    expect(statusClasses('Em Cobertura')).toBe('bg-status-cobertura/12 text-status-cobertura')
  })

  it('mapeia Potro/Potra', () => {
    expect(statusClasses('Potro/Potra')).toBe('bg-status-potro/12 text-status-potro')
  })

  it('cai no neutro para status desconhecido ou ausente', () => {
    expect(statusClasses('Garanhão Ativo')).toBe('bg-muted text-muted-foreground')
    expect(statusClasses(null)).toBe('bg-muted text-muted-foreground')
    expect(statusClasses(undefined)).toBe('bg-muted text-muted-foreground')
  })
})

describe('listas do dominio', () => {
  it('STATUS_REPRODUTIVO contem as opcoes do formulario legado', () => {
    expect(STATUS_REPRODUTIVO).toEqual([
      'Vazia',
      'Prenha',
      'Lactante',
      'Em Cobertura',
      'Potro/Potra',
      'Garanhão Ativo',
    ])
  })

  it('PELAGENS contem as dez opcoes do formulario legado', () => {
    expect(PELAGENS).toHaveLength(10)
    expect(PELAGENS).toContain('Tordilha Negra')
    expect(PELAGENS).toContain('Outra')
  })

  it('TIPOS_MARCHA contem batida e picada', () => {
    expect(TIPOS_MARCHA).toEqual(['Marcha Batida', 'Marcha Picada'])
  })

  it('TIPOS_EVENTO contem os sete tipos do calendario legado', () => {
    expect(TIPOS_EVENTO).toHaveLength(7)
    expect(TIPOS_EVENTO).toContain('Parto Previsto')
  })
})
