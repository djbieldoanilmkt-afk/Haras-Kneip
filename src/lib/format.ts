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
