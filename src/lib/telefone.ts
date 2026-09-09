/**
 * Telefone em formato único (E.164), que é como o WhatsApp identifica quem
 * mandou a mensagem.
 *
 * Guardar o que a pessoa digitou não serve: "(31) 99999-8888", "31999998888"
 * e "+55 31 99999-8888" são a mesma linha e nenhuma delas casa com a outra
 * numa busca por igualdade. Como o agente vai encontrar o membro pelo número
 * que chega do WhatsApp, tudo entra normalizado no banco.
 */

/** Menor e maior DDD que existem no Brasil. */
const DDD_MIN = 11
const DDD_MAX = 99

/**
 * Devolve "+55DDNNNNNNNNN" ou null se o número não for reconhecível.
 *
 * Aceita com e sem +55, com e sem máscara. Aceita fixo (8 dígitos) e celular
 * (9 dígitos) — o haras às vezes cadastra o telefone da sede.
 */
export function normalizarTelefone(entrada: string | null | undefined): string | null {
  const digitos = String(entrada ?? '').replace(/\D/g, '')
  if (digitos === '') return null

  // Com código do país: 55 + DDD(2) + número(8 ou 9).
  const nacional = digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)
    ? digitos.slice(2)
    : digitos

  // Sem código do país sobram DDD(2) + número(8 ou 9).
  if (nacional.length !== 10 && nacional.length !== 11) return null

  const ddd = Number(nacional.slice(0, 2))
  if (ddd < DDD_MIN || ddd > DDD_MAX) return null

  // Celular brasileiro começa com 9 depois do DDD; fixo começa de 2 a 5.
  const primeiro = nacional[2]
  if (nacional.length === 11 && primeiro !== '9') return null
  if (nacional.length === 10 && !'2345'.includes(primeiro)) return null

  return `+55${nacional}`
}

/**
 * "+5531999998888" -> "(31) 99999-8888". Só para exibição.
 *
 * Exige o +55 de propósito. Sem essa exigência, um número estrangeiro como
 * +1 212 555 1234 também tem 11 dígitos e sairia mascarado de brasileiro,
 * como "(12) 12555-1234" — um telefone que não existe. Quando não reconhece,
 * devolve o valor cru: mostrar o original é melhor do que inventar.
 */
export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) return ''
  if (!e164.trim().startsWith('+55')) return e164

  const nacional = e164.replace(/\D/g, '').slice(2)
  if (nacional.length !== 10 && nacional.length !== 11) return e164

  const ddd = nacional.slice(0, 2)
  const corpo = nacional.slice(2)
  const meio = corpo.length === 9 ? corpo.slice(0, 5) : corpo.slice(0, 4)
  const fim = corpo.length === 9 ? corpo.slice(5) : corpo.slice(4)

  return `(${ddd}) ${meio}-${fim}`
}
