import { TIPOS_REPRODUCAO } from './status'
import type { Reproducao } from './database.types'

/**
 * Leituras reprodutivas derivadas do histórico. Funções puras, para poderem
 * ser testadas sem banco.
 */

export const COBERTURA = TIPOS_REPRODUCAO[0] // 'Inseminação / Cobertura'
export const DIAGNOSTICO = TIPOS_REPRODUCAO[1] // 'Diagnóstico de Gestação (DG+)'

export type TaxaDiagnostico = {
  coberturas: number
  diagnosticos: number
  /** Inteiro de 0 a 100; 0 quando não houve cobertura no período. */
  percentual: number
}

/**
 * Quantos diagnósticos positivos houve para cada cobertura registrada.
 *
 * NÃO é a taxa de concepção formal, e o rótulo na tela diz isso: aqui os dois
 * eventos são contados dentro da mesma janela, sem amarrar cada DG+ à
 * cobertura que o originou. Uma égua coberta em dezembro e diagnosticada em
 * janeiro cai em janelas diferentes. Serve como termômetro do período, não
 * como índice zootécnico — para o índice de verdade seria preciso ligar o
 * diagnóstico à cobertura, o que o schema hoje não guarda.
 */
export function taxaDeDiagnostico(eventos: Pick<Reproducao, 'tipo'>[]): TaxaDiagnostico {
  const coberturas = eventos.filter((e) => e.tipo === COBERTURA).length
  const diagnosticos = eventos.filter((e) => e.tipo === DIAGNOSTICO).length

  return {
    coberturas,
    diagnosticos,
    percentual: coberturas === 0 ? 0 : Math.round((diagnosticos / coberturas) * 100),
  }
}

export type CoberturasGaranhao = { garanhao: string; coberturas: number }

/**
 * Coberturas por garanhão, do mais usado para o menos.
 *
 * Só conta eventos de cobertura: o campo `garanhao` também aparece em parto e
 * diagnóstico, e somar todos contaria o mesmo serviço três vezes. Evento sem
 * garanhão informado fica de fora — inventar um "não informado" no ranking
 * competiria com os garanhões reais pelo topo da lista.
 */
export function coberturasPorGaranhao(
  eventos: Pick<Reproducao, 'tipo' | 'garanhao'>[],
): CoberturasGaranhao[] {
  const mapa = new Map<string, number>()

  for (const e of eventos) {
    if (e.tipo !== COBERTURA) continue
    const nome = e.garanhao?.trim()
    if (!nome) continue
    mapa.set(nome, (mapa.get(nome) ?? 0) + 1)
  }

  return [...mapa]
    .map(([garanhao, coberturas]) => ({ garanhao, coberturas }))
    .sort((a, b) => b.coberturas - a.coberturas || a.garanhao.localeCompare(b.garanhao, 'pt-BR'))
}
