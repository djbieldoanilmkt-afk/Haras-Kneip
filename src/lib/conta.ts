import type { Haras } from './database.types'

/** Dias inteiros de trial restantes (0 quando vencido). */
export function diasRestantesTrial(haras: Pick<Haras, 'trial_expira_em'>): number {
  const restanteMs = new Date(haras.trial_expira_em).getTime() - Date.now()
  return Math.max(0, Math.ceil(restanteMs / 86_400_000))
}

/**
 * A conta pode usar o painel? Espelha a função haras_escreve() do banco —
 * a interface bloqueia por cortesia, mas quem manda é o RLS.
 */
export function contaPodeUsar(
  haras: Pick<Haras, 'status_conta' | 'trial_expira_em'>,
): boolean {
  if (haras.status_conta === 'ativa') return true
  if (haras.status_conta === 'bloqueada') return false
  return diasRestantesTrial(haras) > 0
}
