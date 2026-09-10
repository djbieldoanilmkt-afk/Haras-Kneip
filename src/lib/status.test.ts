import { describe, it, expect } from 'vitest'
import {
  statusClasses,
  STATUS_REPRODUTIVO,
  PELAGENS,
  TIPOS_MARCHA,
  TIPOS_EVENTO,
  TIPOS_SAUDE,
  TIPOS_REPRODUCAO,
  METODOS_REPRODUCAO,
} from './status'

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

/*
  Canário do vocabulário.

  Estas listas precisam ser exatamente iguais aos check constraints do banco
  (supabase/migrations/012_vocabulario.sql). Já divergiram uma vez: a tela
  oferecia 'Vacina' e o banco exigia 'Vacinação', então escolher a PRIMEIRA
  opção do formulário de sanidade estourava com violação de constraint — e
  nenhum teste pegou, porque nenhum testava um insert de verdade.

  Fixar os valores aqui não prova que o banco concorda; prova que ninguém os
  mudou sem querer. Quem mexer nesta lista é obrigado a mexer na migração, e
  vice-versa.
*/
describe('vocabulario alinhado com o banco', () => {
  it('tipos de sanidade sao exatamente os aceitos pelo check constraint', () => {
    expect([...TIPOS_SAUDE]).toEqual([
      'Vacinação',
      'Vermifugação',
      'Exame',
      'Ferração',
      'Odontologia',
      'Veterinário',
      'Cirurgia/Tratamento',
      'Outro',
    ])
  })

  it('tipos de reproducao sao exatamente os aceitos pelo check constraint', () => {
    expect([...TIPOS_REPRODUCAO]).toEqual([
      'Cobertura',
      'Diagnóstico de Gestação',
      'Gestação',
      'Parto',
      'Desmame',
      'Cio',
      'Aborto',
    ])
  })

  it('metodos de reproducao sao exatamente os tres aceitos', () => {
    expect([...METODOS_REPRODUCAO]).toEqual([
      'Monta Natural',
      'Inseminação Artificial',
      'Transferência de Embrião',
    ])
  })
})
