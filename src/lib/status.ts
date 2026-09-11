/**
 * Listas do domínio e mapa de status para classes do tema.
 *
 * Substitui getStatusColor de js/utils/helpers.js, que devolvia variáveis CSS
 * do tema antigo. Aqui cada status vira um par de classes Tailwind ligadas aos
 * tokens, o que faz funcionar nos temas claro e escuro.
 */

/*
  Status reprodutivo, separado por sexo.

  A lista unica oferecia 'Garanhao Ativo' para qualquer animal e o banco
  RECUSAVA — quem escolhesse a opcao do menu levava erro de restricao. E
  oferecer 'Vazia' (nao esta prenha) para um garanhao e oferecer uma resposta
  sem sentido, que foi como "Diamante Negro VAZIA" acabou na vitrine publica.

  Espelha `animais_status_combina_com_sexo`, na migracao 033. Mexeu aqui, mexa
  no banco no mesmo passo.
*/
export const STATUS_FEMEA = [
  'Vazia',
  'Prenha',
  'Lactante',
  'Em Cobertura',
  'Potro/Potra',
] as const

export const STATUS_MACHO = ['Garanhão Ativo', 'Castrado', 'Potro/Potra'] as const

/** Todos, para filtros e listagens que nao sabem o sexo de antemao. */
export const STATUS_REPRODUTIVO = [...STATUS_FEMEA, 'Garanhão Ativo', 'Castrado'] as const

export function statusPorSexo(sexo: string): readonly string[] {
  return sexo === 'Macho' ? STATUS_MACHO : STATUS_FEMEA
}

/** Papel da egua na reproducao, como o haras classifica (migracao 031). */
export const FUNCOES_REPRODUTIVAS = ['Matriz', 'Doadora', 'Receptora'] as const

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
  'garanhão ativo': 'bg-status-cobertura/12 text-status-cobertura',
  castrado: 'bg-muted text-muted-foreground',
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
