/**
 * Porte de js/utils/validators.js.
 *
 * No app legado estas funções nunca foram importadas — os formulários só
 * contavam com o atributo `required` do HTML. Aqui elas são efetivamente
 * ligadas aos formulários de animal, evento, saúde e reprodução.
 */

export type ValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

function build(errors: Record<string, string>): ValidationResult {
  return { isValid: Object.keys(errors).length === 0, errors }
}

function vazio(valor: string | null | undefined): boolean {
  return !valor || valor.trim() === ''
}

export function validateAnimal(data: { nome?: string | null; raca?: string | null }): ValidationResult {
  const errors: Record<string, string> = {}
  if (vazio(data.nome)) errors.nome = 'Nome é obrigatório'
  if (vazio(data.raca)) errors.raca = 'Raça é obrigatória'
  return build(errors)
}

export function validateSaude(data: {
  tipo?: string | null
  data_registro?: string | null
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (vazio(data.tipo)) errors.tipo = 'Tipo é obrigatório'
  if (vazio(data.data_registro)) errors.data_registro = 'Data é obrigatória'
  return build(errors)
}

export function validateReproducao(data: {
  tipo?: string | null
  data_evento?: string | null
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (vazio(data.tipo)) errors.tipo = 'Tipo é obrigatório'
  if (vazio(data.data_evento)) errors.data_evento = 'Data é obrigatória'
  return build(errors)
}

export function validateEvento(data: {
  titulo?: string | null
  data_evento?: string | null
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (vazio(data.titulo)) errors.titulo = 'Título é obrigatório'
  if (vazio(data.data_evento)) errors.data_evento = 'Data é obrigatória'
  return build(errors)
}
