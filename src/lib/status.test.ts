import { describe, it, expect } from 'vitest'
import {
  statusClasses,
  FUNCOES_REPRODUTIVAS,
  statusPorSexo,
  PELAGENS,
  TIPOS_MARCHA,
  TIPOS_EVENTO,
  TIPOS_EVENTO_COM_CUSTO,
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

  it('mapeia os status de macho', () => {
    // 'Garanhao Ativo' era usado aqui como exemplo de status DESCONHECIDO.
    // Deixou de ser: a tela ja oferecia a opcao, so o banco e as cores e que
    // nao a conheciam.
    expect(statusClasses('Garanhão Ativo')).toBe('bg-status-cobertura/12 text-status-cobertura')
    expect(statusClasses('Castrado')).toBe('bg-muted text-muted-foreground')
  })

  it('cai no neutro para status desconhecido ou ausente', () => {
    expect(statusClasses('Inventado')).toBe('bg-muted text-muted-foreground')
    expect(statusClasses(null)).toBe('bg-muted text-muted-foreground')
    expect(statusClasses(undefined)).toBe('bg-muted text-muted-foreground')
  })
})

describe('listas do dominio', () => {
  it('a lista por sexo nao oferece status que o banco recusa', () => {
    /*
      A restricao `animais_status_combina_com_sexo` (migracao 033) recusa
      "macho vazia" e "femea castrada". Se a tela oferecer o que o banco
      recusa, a pessoa escolhe a opcao do menu e leva erro -- ja aconteceu
      tres vezes neste projeto.
    */
    expect(statusPorSexo('Fêmea')).not.toContain('Castrado')
    expect(statusPorSexo('Fêmea')).not.toContain('Garanhão Ativo')
    expect(statusPorSexo('Macho')).not.toContain('Vazia')
    expect(statusPorSexo('Macho')).not.toContain('Prenha')
    expect(statusPorSexo('Macho')).toContain('Castrado')
    expect(statusPorSexo('Macho')).toContain('Garanhão Ativo')
    // Potro/Potra serve aos dois.
    expect(statusPorSexo('Macho')).toContain('Potro/Potra')
    expect(statusPorSexo('Fêmea')).toContain('Potro/Potra')
  })

  it('FUNCOES_REPRODUTIVAS espelha a restricao do banco', () => {
    expect(FUNCOES_REPRODUTIVAS).toEqual(['Matriz', 'Doadora', 'Receptora'])
  })

  it('PELAGENS contem as dez opcoes do formulario legado', () => {
    expect(PELAGENS).toHaveLength(10)
    expect(PELAGENS).toContain('Tordilha Negra')
    expect(PELAGENS).toContain('Outra')
  })

  it('TIPOS_MARCHA contem batida e picada', () => {
    expect(TIPOS_MARCHA).toEqual(['Marcha Batida', 'Marcha Picada'])
  })

  it('TIPOS_EVENTO cobre agenda e evento com custo', () => {
    // Contagem fixa quebrava a cada tipo novo sem dizer o que importa. O que
    // importa e que a lista espelhe `eventos_tipo_check` (migracao 035).
    expect(TIPOS_EVENTO).toContain('Parto Previsto')
    // Competicao e exposicao entraram para virar centro de custo: e nelas que
    // carreto, alimentacao e inscricao sao somados.
    expect(TIPOS_EVENTO).toContain('Competição')
    expect(TIPOS_EVENTO).toContain('Exposição')
    expect(TIPOS_EVENTO_COM_CUSTO.every((t) => TIPOS_EVENTO.includes(t))).toBe(true)
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
