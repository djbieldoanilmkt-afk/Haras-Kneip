/*
  O guardrail do laudo morfológico.

  O módulo inteiro se apoia numa proibição: enquanto o protocolo for rascunho,
  o laudo NÃO afirma o que o padrão da raça exige — porque ninguém conferiu o
  documento oficial da ABCCMM. Até aqui isso era uma instrução no prompt do
  modelo de visão, e nada verificava se ela foi obedecida.

  Instrução em prompt é pedido, não garantia. Este arquivo transforma em
  verificação: cada região examinada por uma pergunta de sim/não, e o texto que
  afirma regra racial não é impresso no documento.

  POR QUE O JEV E NÃO OUTRA CHAMADA DO MESMO MODELO

  Pedir ao mesmo modelo que revise o que ele acabou de escrever é pedir que ele
  discorde de si mesmo. E custaria de novo o preço de uma chamada de visão. O
  Jev decide sim/não em meio segundo por uma fração de centavo, e não escreveu
  o texto que está julgando.

  Puro de propósito: monta o pedido e lê o veredito sem rede, então o teste
  roda sem chamar nada.
*/

export type TextoDaNota = {
  criterio: string
  analise: string | null
  pontos_fortes: string[]
  pontos_atencao: string[]
}

/*
  Medido com frases escritas para imitar a saída do modelo de visão:
  descrição comum deu 29% e 3%; afirmação de regra racial deu 95% e 92%.
  0,7 fica no vão, com folga dos dois lados.

  A assimetria é deliberada. Barrar à toa custa um parágrafo de prosa — a nota,
  os pontos e as evidências continuam no laudo. Deixar passar custa um
  documento assinado afirmando padrão de raça que ninguém conferiu.
*/
export const LIMIAR_REGRA_RACIAL = 0.7

const PERGUNTA =
  'Este texto AFIRMA uma regra do padrão oficial da raça — o que a raça ' +
  'exige, espera, determina ou considera correto?'

const SE_SIM =
  'afirma exigência, norma ou expectativa do padrão da raça, mesmo de passagem'

const SE_NAO =
  'apenas descreve o que se vê no animal, julga a conformação em si, ou ' +
  'relata limitação da imagem'

/** O bloco de texto que o leitor do laudo vê para uma região. */
function prosa(n: TextoDaNota): string {
  return [n.analise ?? '', ...(n.pontos_fortes ?? []), ...(n.pontos_atencao ?? [])]
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Monta a chamada: o material de todas as regiões e uma pergunta para cada.
 *
 * Uma chamada só, nunca uma por região — a própria TypeSafe mede que juntar é
 * 12,2× mais barato e 10× mais rápido.
 *
 * @returns nulo quando não há texto nenhum a examinar: aí não se paga chamada.
 */
export function pedidoDoGuardrail(
  notas: TextoDaNota[],
): { state: Record<string, string>; questions: Record<string, unknown> } | null {
  const state: Record<string, string> = {}
  const questions: Record<string, unknown> = {}

  for (const n of notas ?? []) {
    const texto = prosa(n)
    if (!texto) continue
    state[n.criterio] = texto
    questions[n.criterio] = {
      type: 'noul',
      instructions: `${PERGUNTA} Considere apenas o texto da região "${n.criterio}".`,
      criteria: { true: SE_SIM, false: SE_NAO },
    }
  }

  return Object.keys(questions).length === 0 ? null : { state, questions }
}

export type Veredito = { barrado: boolean; probabilidade: number }

/**
 * Lê as respostas do Jev e diz o que não pode ser impresso.
 *
 * Região sem resposta simplesmente não entra no mapa — e quem chama trata
 * ausência como "não barrado". Guardrail que falha fechado engoliria o laudo
 * inteiro numa instabilidade de rede; quem decide barrar é uma resposta, e
 * ausência de resposta não é uma.
 */
export function lerVeredito(
  resposta: { answers?: Record<string, { noul?: number }> },
  limiar: number = LIMIAR_REGRA_RACIAL,
): Map<string, Veredito> {
  const mapa = new Map<string, Veredito>()
  for (const [criterio, a] of Object.entries(resposta?.answers ?? {})) {
    const p = a?.noul
    if (typeof p !== 'number' || !Number.isFinite(p)) continue
    mapa.set(criterio, { barrado: p >= limiar, probabilidade: p })
  }
  return mapa
}
