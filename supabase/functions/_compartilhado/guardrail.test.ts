import { describe, expect, test } from 'vitest'
import { LIMIAR_REGRA_RACIAL, lerVeredito, pedidoDoGuardrail } from './guardrail'

const NOTAS = [
  {
    criterio: 'garupa_ancas',
    analise: 'A garupa apresenta boa musculatura e inclinação harmônica com o dorso.',
    pontos_fortes: ['ligação suave com o lombo'],
    pontos_atencao: [],
  },
  {
    criterio: 'cabeca_expressao',
    analise: 'Para a raça, espera-se perfil retilíneo, o que este exemplar apresenta.',
    pontos_fortes: [],
    pontos_atencao: ['olho pouco visível na imagem'],
  },
]

describe('pedidoDoGuardrail', () => {
  test('uma chamada só, com uma pergunta por região', () => {
    const p = pedidoDoGuardrail(NOTAS)!
    expect(Object.keys(p.questions).sort()).toEqual(['cabeca_expressao', 'garupa_ancas'])
    expect(Object.keys(p.state as object).sort()).toEqual(['cabeca_expressao', 'garupa_ancas'])
  })

  /*
    O leitor do laudo vê a região inteira como um bloco: a análise e os pontos.
    Uma afirmação de regra racial escondida num marcador conta igual, então o
    material examinado é o bloco todo.
  */
  test('o material examinado inclui os pontos, não só a análise', () => {
    const p = pedidoDoGuardrail(NOTAS)!
    const texto = JSON.stringify((p.state as Record<string, unknown>).garupa_ancas)
    expect(texto).toContain('ligação suave com o lombo')
    expect(texto).toContain('musculatura')
  })

  test('cada pergunta é de sim/não', () => {
    const p = pedidoDoGuardrail(NOTAS)!
    for (const q of Object.values(p.questions)) {
      expect((q as { type: string }).type).toBe('noul')
    }
  })

  test('região sem texto nenhum não vira pergunta', () => {
    const p = pedidoDoGuardrail([
      { criterio: 'tronco', analise: null, pontos_fortes: [], pontos_atencao: [] },
      NOTAS[0],
    ])!
    expect(Object.keys(p.questions)).toEqual(['garupa_ancas'])
  })

  /* Sem texto para examinar não se paga chamada nenhuma. */
  test('nada para examinar devolve nulo', () => {
    expect(pedidoDoGuardrail([])).toBeNull()
    expect(
      pedidoDoGuardrail([
        { criterio: 'tronco', analise: '   ', pontos_fortes: [], pontos_atencao: [] },
      ]),
    ).toBeNull()
  })
})

describe('lerVeredito', () => {
  function resposta(probabilidades: Record<string, number>) {
    return {
      answers: Object.fromEntries(
        Object.entries(probabilidades).map(([k, v]) => [k, { type: 'noul', noul: v }]),
      ),
    }
  }

  test('acima do limiar, o texto é barrado', () => {
    const v = lerVeredito(resposta({ cabeca_expressao: 0.92 }))
    expect(v.get('cabeca_expressao')).toMatchObject({ barrado: true })
  })

  test('abaixo do limiar, passa', () => {
    const v = lerVeredito(resposta({ garupa_ancas: 0.29 }))
    expect(v.get('garupa_ancas')).toMatchObject({ barrado: false })
  })

  /*
    O limiar fica no vão medido: descrição comum deu 29% e 3%; afirmação de
    regra deu 95% e 92%. 0,7 está dentro da folga dos dois lados.
  */
  test('o limiar está no vão entre o que foi medido', () => {
    expect(LIMIAR_REGRA_RACIAL).toBeGreaterThan(0.3)
    expect(LIMIAR_REGRA_RACIAL).toBeLessThan(0.9)
  })

  test('a probabilidade volta junto, para o laudo poder registrar', () => {
    const v = lerVeredito(resposta({ aprumos: 0.95 }))
    expect(v.get('aprumos')!.probabilidade).toBe(0.95)
  })

  /*
    Se o Jev não respondeu sobre uma região, o texto NÃO é barrado.

    Guardrail que falha fechado engoliria o laudo inteiro numa instabilidade de
    rede. Quem decide barrar é uma resposta; ausência de resposta não é uma.
  */
  test('região sem resposta não é barrada por omissão', () => {
    const v = lerVeredito(resposta({}))
    expect(v.get('garupa_ancas')).toBeUndefined()
  })

  test('resposta torta não derruba a leitura', () => {
    const v = lerVeredito({ answers: { x: { type: 'noul' } } } as never)
    expect(v.get('x')).toBeUndefined()
    expect(lerVeredito({} as never).size).toBe(0)
  })
})
