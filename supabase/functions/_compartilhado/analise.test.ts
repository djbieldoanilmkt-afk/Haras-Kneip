import { describe, expect, test } from 'vitest'
import { lerNotasDoModelo } from './analise'

const PERMITIDOS = ['aprumos', 'tronco', 'garupa_ancas']

function resposta(notas: unknown) {
  return JSON.stringify({ notas })
}

describe('lerNotasDoModelo', () => {
  test('lê a resposta normal', () => {
    const r = lerNotasDoModelo(
      resposta([
        {
          criterio: 'aprumos',
          nota: 7.5,
          confianca: 8,
          pontos_fortes: ['aprumo anterior correto'],
          pontos_atencao: ['leve desvio no posterior esquerdo'],
          analise: 'Visto de frente, os membros...',
          evidencias: [{ imagem: 'FRENTE', observacao: 'linha do casco' }],
        },
      ]),
      PERMITIDOS,
    )
    expect(r.ignorados).toEqual([])
    expect(r.notas).toHaveLength(1)
    expect(r.notas[0]).toMatchObject({ criterio: 'aprumos', nota: 7.5, confianca: 8 })
    expect(r.notas[0].pontos_atencao).toEqual(['leve desvio no posterior esquerdo'])
  })

  /*
    O modelo embrulha em cerca de código mesmo quando o formato JSON é pedido.
    Já aconteceu no agente do WhatsApp; aqui seria uma avaliação inteira
    perdida.
  */
  test('aguenta a resposta embrulhada em cerca de código', () => {
    const bruto = '```json\n' + resposta([{ criterio: 'tronco', nota: 8 }]) + '\n```'
    expect(lerNotasDoModelo(bruto, PERMITIDOS).notas[0].nota).toBe(8)
  })

  test('aceita a lista solta, sem o embrulho `notas`', () => {
    const bruto = JSON.stringify([{ criterio: 'tronco', nota: 6 }])
    expect(lerNotasDoModelo(bruto, PERMITIDOS).notas[0].criterio).toBe('tronco')
  })

  /*
    Prompt em português, modelo respondendo em português: "7,5" acontece. Sem
    isto a nota viraria NaN e a região ficaria sem avaliação.
  */
  test('nota com vírgula decimal é lida como número', () => {
    const r = lerNotasDoModelo(resposta([{ criterio: 'tronco', nota: '7,5' }]), PERMITIDOS)
    expect(r.notas[0].nota).toBe(7.5)
  })

  /*
    A trava central: o modelo não inventa região.

    "temperamento" não está no protocolo. Deixar passar faria a nota cair numa
    gaveta sem peso — e o banco recusaria depois, já com a chamada paga.
  */
  test('região que não está na pauta é descartada e relatada', () => {
    const r = lerNotasDoModelo(
      resposta([
        { criterio: 'temperamento', nota: 9 },
        { criterio: 'tronco', nota: 7 },
      ]),
      PERMITIDOS,
    )
    expect(r.notas.map((n) => n.criterio)).toEqual(['tronco'])
    expect(r.ignorados.join(' ')).toContain('temperamento')
  })

  test('nota fora da escala é descartada, nunca aparada', () => {
    const r = lerNotasDoModelo(
      resposta([
        { criterio: 'tronco', nota: 12 },
        { criterio: 'aprumos', nota: -1 },
        { criterio: 'garupa_ancas', nota: 7 },
      ]),
      PERMITIDOS,
    )
    expect(r.notas.map((n) => n.criterio)).toEqual(['garupa_ancas'])
    expect(r.ignorados).toHaveLength(2)
  })

  test('a primeira leitura de uma região vale; repetição é ignorada', () => {
    const r = lerNotasDoModelo(
      resposta([
        { criterio: 'tronco', nota: 7 },
        { criterio: 'tronco', nota: 9 },
      ]),
      PERMITIDOS,
    )
    expect(r.notas).toHaveLength(1)
    expect(r.notas[0].nota).toBe(7)
  })

  test('confiança ausente vira nulo, não zero', () => {
    const r = lerNotasDoModelo(resposta([{ criterio: 'tronco', nota: 7 }]), PERMITIDOS)
    expect(r.notas[0].confianca).toBeNull()
  })

  test('confiança fora da escala é descartada sem derrubar a nota', () => {
    const r = lerNotasDoModelo(
      resposta([{ criterio: 'tronco', nota: 7, confianca: 99 }]),
      PERMITIDOS,
    )
    expect(r.notas[0].nota).toBe(7)
    expect(r.notas[0].confianca).toBeNull()
  })

  test('campos de texto que vieram torto não quebram a leitura', () => {
    const r = lerNotasDoModelo(
      resposta([
        {
          criterio: 'tronco',
          nota: 7,
          pontos_fortes: 'profundidade boa',
          pontos_atencao: null,
          evidencias: 'sem estrutura',
        },
      ]),
      PERMITIDOS,
    )
    expect(r.notas[0].pontos_fortes).toEqual(['profundidade boa'])
    expect(r.notas[0].pontos_atencao).toEqual([])
    expect(r.notas[0].evidencias).toEqual([])
  })

  test('resposta ilegível devolve vazio em vez de estourar', () => {
    for (const lixo of ['', 'desculpe, não consigo analisar', '{quebrado', 'null']) {
      const r = lerNotasDoModelo(lixo, PERMITIDOS)
      expect(r.notas).toEqual([])
    }
  })

  test('sem nenhuma nota válida, o motivo fica registrado', () => {
    const r = lerNotasDoModelo(resposta([{ criterio: 'inventado', nota: 8 }]), PERMITIDOS)
    expect(r.notas).toEqual([])
    expect(r.ignorados.length).toBeGreaterThan(0)
  })
})
