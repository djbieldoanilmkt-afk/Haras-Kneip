/**
 * Listas do domínio e mapa de status para classes do tema.
 *
 * Substitui getStatusColor de js/utils/helpers.js, que devolvia variáveis CSS
 * do tema antigo. Aqui cada status vira um par de classes Tailwind ligadas aos
 * tokens, o que faz funcionar nos temas claro e escuro.
 */

export const STATUS_REPRODUTIVO = [
  'Vazia',
  'Prenha',
  'Lactante',
  'Em Cobertura',
  'Potro/Potra',
  'Garanhão Ativo',
] as const

export const PELAGENS = [
  'Alazã',
  'Baia',
  'Castanha',
  'Pampa',
  'Preta',
  'Rosilha',
  'Tordilha',
  'Tordilha Negra',
  'Zaina',
  'Outra',
] as const

export const TIPOS_MARCHA = ['Marcha Batida', 'Marcha Picada'] as const

export const TIPOS_EVENTO = [
  'Vacinação',
  'Vermifugação',
  'Parto Previsto',
  'Ferração',
  'Veterinário',
  'Cobertura',
  'Outro',
] as const

/*
  Estas listas espelham os check constraints do banco (012_vocabulario.sql).

  Divergiam: a tela oferecia 'Vacina' e o banco exigia 'Vacinação', então
  escolher a PRIMEIRA opção do formulário de sanidade estourava com violação
  de constraint. O mesmo em cinco dos seis tipos de reprodução. Se mexer aqui,
  mexa lá — ou o formulário volta a oferecer o que o banco recusa.
*/
export const TIPOS_SAUDE = [
  'Vacinação',
  'Vermifugação',
  'Exame',
  'Ferração',
  'Odontologia',
  'Veterinário',
  'Cirurgia/Tratamento',
  'Outro',
] as const

export const TIPOS_REPRODUCAO = [
  'Cobertura',
  'Diagnóstico de Gestação',
  'Gestação',
  'Parto',
  'Desmame',
  'Cio',
  'Aborto',
] as const

/** O banco também restringe o método; era campo livre na tela. */
export const METODOS_REPRODUCAO = [
  'Monta Natural',
  'Inseminação Artificial',
  'Transferência de Embrião',
] as const

const CLASSES: Record<string, string> = {
  vazia: 'bg-status-vazia/12 text-status-vazia',
  prenha: 'bg-status-prenha/12 text-status-prenha',
  lactante: 'bg-status-lactante/12 text-status-lactante',
  'em cobertura': 'bg-status-cobertura/12 text-status-cobertura',
  'potro/potra': 'bg-status-potro/12 text-status-potro',
}

const NEUTRO = 'bg-muted text-muted-foreground'

export function statusClasses(status: string | null | undefined): string {
  if (!status) return NEUTRO
  return CLASSES[status.toLowerCase()] ?? NEUTRO
}

/** Classe de cor sólida por tipo de evento, usada nos pontos do calendário. */
const EVENTO_CLASSES: Record<string, string> = {
  Vacinação: 'bg-status-lactante',
  Vermifugação: 'bg-status-cobertura',
  'Parto Previsto': 'bg-status-prenha',
  Ferração: 'bg-status-potro',
  Veterinário: 'bg-destructive',
  Cobertura: 'bg-primary',
  Outro: 'bg-muted-foreground',
}

export function eventoClasse(tipo: string | null | undefined): string {
  if (!tipo) return EVENTO_CLASSES.Outro
  return EVENTO_CLASSES[tipo] ?? EVENTO_CLASSES.Outro
}
