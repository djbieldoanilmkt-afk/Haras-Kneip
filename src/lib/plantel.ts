import type { Animal } from './database.types'

/**
 * Leituras do plantel que não dependem do banco: tudo aqui deriva da lista de
 * animais que a página já carregou. Ficam em funções puras para poderem ser
 * testadas sem montar tela nem simular o Supabase.
 */

export const SEM_LOCAL = 'Sem local definido'

export type Lote = { local: string; animais: Animal[] }

/**
 * Agrupa o plantel por baia ou piquete.
 *
 * Ordem alfabética, e não por lotação: quem abre esta lista costuma estar
 * procurando um piquete específico, e a posição dele não pode mudar toda vez
 * que um animal troca de lugar. O balde "sem local" vai para o fim — é uma
 * lacuna de cadastro, não um lugar do haras.
 */
export function agruparPorLocal(animais: Animal[]): Lote[] {
  const mapa = new Map<string, Animal[]>()

  for (const a of animais) {
    const local = a.baia_piquete?.trim() || SEM_LOCAL
    const lote = mapa.get(local)
    if (lote) lote.push(a)
    else mapa.set(local, [a])
  }

  return [...mapa]
    .map(([local, lista]) => ({ local, animais: lista }))
    .sort((x, y) => {
      if (x.local === SEM_LOCAL) return 1
      if (y.local === SEM_LOCAL) return -1
      return x.local.localeCompare(y.local, 'pt-BR')
    })
}

export type Lacuna = { campo: string; rotulo: string; faltando: number }

/**
 * Campos que valem cobrar. A lista é curta de propósito: cobrar tudo vira
 * ruído e a pessoa para de olhar o aviso.
 */
const CAMPOS_COBRADOS = [
  { campo: 'foto_url', rotulo: 'Sem foto' },
  { campo: 'registro_abccmm', rotulo: 'Sem registro ABCCMM' },
  { campo: 'data_nascimento', rotulo: 'Sem data de nascimento' },
  { campo: 'pelagem', rotulo: 'Sem pelagem' },
  { campo: 'baia_piquete', rotulo: 'Sem piquete' },
] as const

function preenchido(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false
  return String(valor).trim() !== ''
}

/** Quantos animais faltam preencher cada campo, do mais furado para o menos. */
export function lacunasDeCadastro(animais: Animal[]): Lacuna[] {
  return CAMPOS_COBRADOS.map(({ campo, rotulo }) => ({
    campo,
    rotulo,
    faltando: animais.filter((a) => !preenchido(a[campo as keyof Animal])).length,
  }))
    .filter((l) => l.faltando > 0)
    .sort((x, y) => y.faltando - x.faltando)
}

/**
 * Percentual de campos cobrados que estão preenchidos no plantel inteiro.
 *
 * Plantel vazio devolve 100, e não 0: não há nada por preencher, então
 * mostrar "0% completo" para quem acabou de criar a conta seria uma
 * reprimenda sem sentido.
 */
export function completudeDoCadastro(animais: Animal[]): number {
  if (animais.length === 0) return 100

  const total = animais.length * CAMPOS_COBRADOS.length
  const cheios = animais.reduce(
    (soma, a) => soma + CAMPOS_COBRADOS.filter((c) => preenchido(a[c.campo as keyof Animal])).length,
    0,
  )
  return Math.round((cheios / total) * 100)
}
