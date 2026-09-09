/**
 * Porte de js/utils/helpers.js (formatDate e calcularIdade).
 *
 * Diferença deliberada em relação ao legado: as duas funções tratam datas no
 * formato "AAAA-MM-DD" decompondo a string, em vez de passar por `new Date()`.
 * O legado fazia `new Date('2026-05-11')`, que o JavaScript interpreta como
 * meia-noite UTC — em fuso negativo isso vira o dia anterior no horário local,
 * e a data exibida saía um dia atrasada.
 */

type DataISO = string | null | undefined

/** Decompõe "AAAA-MM-DD" ou "AAAA-MM-DDTHH:mm:ssZ" em partes de calendário. */
function partes(valor: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!m) return null
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

export function formatDate(dateString: DataISO): string {
  if (!dateString) return ''

  const p = partes(dateString)
  if (!p) return ''

  const dd = String(p.dia).padStart(2, '0')
  const mm = String(p.mes).padStart(2, '0')
  return `${dd}/${mm}/${p.ano}`
}

export function calcularIdade(dataNascimento: DataISO): string {
  if (!dataNascimento) return 'Desconhecida'

  const nasc = partes(dataNascimento)
  if (!nasc) return 'Desconhecida'

  const hoje = new Date()
  const hojeAno = hoje.getFullYear()
  const hojeMes = hoje.getMonth() + 1
  const hojeDia = hoje.getDate()

  let anos = hojeAno - nasc.ano
  let meses = hojeMes - nasc.mes

  // O legado só descontava o dia quando `meses` era exatamente zero, então
  // contava um mês a mais para quem nasceu num dia do mês ainda não alcançado.
  if (hojeDia < nasc.dia) meses--

  if (meses < 0) {
    anos--
    meses += 12
  }

  if (anos < 0) return 'Desconhecida'

  if (anos === 0) {
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

/**
 * Dias inteiros entre hoje e uma data "AAAA-MM-DD". Negativo = já passou.
 *
 * A conta é feita em partes de calendário, e não em milissegundos: subtrair
 * timestamps erra por um dia nas viradas de horário de verão, quando o dia
 * tem 23 ou 25 horas.
 */
export function diasAte(data: DataISO): number {
  const p = partes(String(data ?? ''))
  if (!p) return 0

  const alvo = new Date(p.ano, p.mes - 1, p.dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

export function rotuloPrazo(dias: number): string {
  if (dias < -1) return `Há ${Math.abs(dias)} dias`
  if (dias === -1) return 'Ontem'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias} dias`
}

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

/** Valor em reais, sem centavos — no painel os centavos só poluem. */
export function formatBRL(valor: number | null | undefined): string {
  return MOEDA.format(valor ?? 0)
}

/** "2026-09" -> "set/26", para o eixo do gráfico de custo. */
export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
  return `${nome.replace('.', '')}/${String(ano).slice(2)}`
}
