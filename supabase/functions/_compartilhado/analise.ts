/*
  A leitura da resposta do modelo.

  Isto é a fronteira entre o que o modelo devolveu e o que o banco vai aceitar.
  Tudo que passa daqui já foi conferido: a região existe na pauta, a nota está
  na escala, e o texto é texto.

  POR QUE DESCARTAR EM VEZ DE APARAR

  Nota 12 não é "10 com entusiasmo": é sinal de que o modelo não entendeu a
  escala naquela região. Aparar para 10 esconderia o problema e gravaria um
  número que ninguém disse. Descartar deixa a região sem nota — o que aparece
  no laudo e na conta da nota geral — e o motivo fica registrado.

  Pura de propósito: roda no teste sem rede, sem Deno e sem modelo nenhum.
*/

export type NotaLida = {
  criterio: string
  nota: number
  confianca: number | null
  pontos_fortes: string[]
  pontos_atencao: string[]
  analise: string | null
  evidencias: unknown[]
}

export type Leitura = {
  notas: NotaLida[]
  /** O que foi jogado fora, e por quê. Vai para o log e para a tarefa. */
  ignorados: string[]
}

/** Número que pode ter vindo como texto, e com vírgula decimal. */
function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Texto solto onde se esperava lista vira lista de um item. */
function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim()).map(String)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

function textoOuNulo(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Converte a resposta bruta em notas que o banco aceita.
 *
 * @param bruto     o conteúdo da mensagem do modelo, como veio
 * @param permitidos as chaves de critério desta pauta — nada fora disso entra
 */
export function lerNotasDoModelo(bruto: string, permitidos: string[]): Leitura {
  const ignorados: string[] = []

  /* Cerca de código aparece mesmo pedindo JSON — já aconteceu no agente. */
  const limpo = String(bruto ?? '')
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim()

  let dados: unknown
  try {
    dados = JSON.parse(limpo)
  } catch {
    return { notas: [], ignorados: ['a resposta do modelo não era JSON'] }
  }

  const bruta = Array.isArray(dados)
    ? dados
    : Array.isArray((dados as { notas?: unknown })?.notas)
      ? (dados as { notas: unknown[] }).notas
      : null

  if (!bruta) return { notas: [], ignorados: ['a resposta não trouxe lista de notas'] }

  const notas: NotaLida[] = []
  const vistos = new Set<string>()

  for (const item of bruta) {
    const o = (item ?? {}) as Record<string, unknown>
    const criterio = typeof o.criterio === 'string' ? o.criterio.trim() : ''

    if (!permitidos.includes(criterio)) {
      ignorados.push(`"${criterio || '(sem nome)'}" não está na pauta deste grupo`)
      continue
    }
    /* Duas leituras da mesma região na mesma resposta: vale a primeira. A
       segunda sobrescreveria sem que ninguém tivesse pedido. */
    if (vistos.has(criterio)) {
      ignorados.push(`"${criterio}" veio duas vezes; usei a primeira`)
      continue
    }

    const nota = numero(o.nota)
    if (nota === null || nota < 0 || nota > 10) {
      ignorados.push(`"${criterio}" veio com nota ${JSON.stringify(o.nota)}, fora da escala`)
      continue
    }

    /* Confiança torta não custa a nota: ela é um adorno útil, não o dado. */
    const conf = numero(o.confianca)
    const confianca = conf !== null && conf >= 0 && conf <= 10 ? conf : null

    vistos.add(criterio)
    notas.push({
      criterio,
      nota,
      confianca,
      pontos_fortes: lista(o.pontos_fortes),
      pontos_atencao: lista(o.pontos_atencao),
      analise: textoOuNulo(o.analise),
      evidencias: Array.isArray(o.evidencias) ? o.evidencias : [],
    })
  }

  return { notas, ignorados }
}
