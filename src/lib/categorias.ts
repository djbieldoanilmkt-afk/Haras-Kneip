/**
 * Categorias de despesa.
 *
 * Lista fechada, e não texto livre: o valor da tela de custo vem de somar por
 * categoria, e "Ração", "ração" e "Racao" digitados à mão viram três linhas
 * diferentes no relatório. A ordem segue o peso típico no orçamento de um
 * haras, para que o mais lançado fique no topo da lista.
 */
export const CATEGORIAS_DESPESA = [
  'Ração e suplemento',
  'Ferrageamento',
  'Veterinário',
  'Medicamento',
  'Mão de obra',
  'Transporte',
  'Manutenção',
  'Taxas e registro',
  'Outros',
] as const

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]
