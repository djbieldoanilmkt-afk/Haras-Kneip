/**
 * Slug da vitrine pública: o endereço que o criador manda no WhatsApp.
 * Minúsculas, dígitos e hífens simples — o mesmo formato validado pelo
 * check constraint da tabela `haras`.
 */

const FORMATO = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MIN = 3
const MAX = 40

/** Sugestão de slug a partir do nome do haras. */
export function gerarSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento soltas pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // qualquer outra coisa vira hífen
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX)
    .replace(/-+$/, '')
}

export type ValidacaoSlug = { valido: boolean; motivo?: string }

export function validarSlug(slug: string): ValidacaoSlug {
  if (slug.length < MIN) {
    return { valido: false, motivo: `Use pelo menos ${MIN} caracteres.` }
  }
  if (slug.length > MAX) {
    return { valido: false, motivo: `Use no máximo ${MAX} caracteres.` }
  }
  if (!FORMATO.test(slug)) {
    return {
      valido: false,
      motivo: 'Use só letras minúsculas, números e hífens (sem hífen nas pontas).',
    }
  }
  return { valido: true }
}
