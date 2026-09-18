import { describe, it, expect } from 'vitest'
import { STEPS, isSkip } from './voiceWizard'

function interpretar(chave: string, texto: string) {
  const passo = STEPS.find((s) => s.key === chave)
  if (!passo) throw new Error(`passo ${chave} nao existe`)
  return passo.parse(texto)
}

describe('isSkip', () => {
  it('reconhece as formas de pular', () => {
    for (const t of ['pular', 'não sei', 'nao sei', 'próximo', 'passar']) {
      expect(isSkip(t)).toBe(true)
    }
  })

  it('nao confunde texto normal com pular', () => {
    expect(isSkip('Aurora da Kneip')).toBe(false)
  })
})

describe('roteiro', () => {
  it('tem treze passos', () => {
    expect(STEPS).toHaveLength(13)
  })

  it('comeca pelo nome e termina na premiacao', () => {
    expect(STEPS[0].key).toBe('nome')
    expect(STEPS.at(-1)?.key).toBe('premiacao')
  })
})

describe('interpretacao de sexo', () => {
  it('mapeia variacoes para Fêmea', () => {
    for (const t of ['égua', 'egua', 'fêmea', 'femea']) {
      expect(interpretar('sexo', t)).toBe('Fêmea')
    }
  })

  it('mapeia variacoes para Macho', () => {
    for (const t of ['garanhão', 'garanhao', 'macho', 'cavalo']) {
      expect(interpretar('sexo', t)).toBe('Macho')
    }
  })
})

describe('interpretacao de pelagem', () => {
  it('normaliza radicais', () => {
    expect(interpretar('pelagem', 'é castanha')).toBe('Castanha')
    expect(interpretar('pelagem', 'tordilho')).toBe('Tordilha')
    expect(interpretar('pelagem', 'alazão')).toBe('Alazã')
    expect(interpretar('pelagem', 'zaino')).toBe('Zaina')
  })
})

describe('interpretacao de marcha', () => {
  it('reconhece picada e batida', () => {
    expect(interpretar('tipo_marcha', 'marcha picada')).toBe('Marcha Picada')
    expect(interpretar('tipo_marcha', 'batida')).toBe('Marcha Batida')
  })

  it('assume batida quando nao entende', () => {
    expect(interpretar('tipo_marcha', 'sei la')).toBe('Marcha Batida')
  })
})

describe('interpretacao de altura', () => {
  it('converte centimetros falados para metros', () => {
    expect(interpretar('altura', '152')).toBe('1.52')
  })

  it('aceita metros com virgula', () => {
    expect(interpretar('altura', '1,52')).toBe('1.52')
  })

  it('devolve vazio ao pular', () => {
    expect(interpretar('altura', 'pular')).toBe('')
  })
})

describe('interpretacao de data de nascimento', () => {
  it('extrai o ano e assume primeiro de janeiro', () => {
    expect(interpretar('data_nascimento', 'nasceu em 2020')).toBe('2020-01-01')
  })

  it('devolve vazio quando nao acha ano', () => {
    expect(interpretar('data_nascimento', 'não lembro')).toBe('')
  })
})

describe('interpretacao de status reprodutivo', () => {
  it('reconhece os status conhecidos', () => {
    expect(interpretar('status_reprodutivo', 'está prenha')).toBe('Prenha')
    expect(interpretar('status_reprodutivo', 'lactante')).toBe('Lactante')
    expect(interpretar('status_reprodutivo', 'em cobertura')).toBe('Em Cobertura')
    expect(interpretar('status_reprodutivo', 'é uma potra')).toBe('Potro/Potra')
  })

  it('assume vazia quando nao entende', () => {
    expect(interpretar('status_reprodutivo', 'blablabla')).toBe('Vazia')
  })
})

describe('interpretacao de peso', () => {
  it('extrai o numero', () => {
    expect(interpretar('peso', '450 quilos')).toBe('450')
  })
})
