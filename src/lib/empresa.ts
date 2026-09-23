/**
 * Dados da empresa que operam o rodapé e as páginas legais.
 *
 * PREENCHER antes de publicar. Os valores marcados como pendentes aparecem na
 * página como aviso visível — de propósito: um rodapé com "CNPJ: 00.000.000"
 * é pior que um rodapé sem CNPJ, porque parece descuido em vez de obra em
 * andamento.
 */
export const EMPRESA = {
  razaoSocial: null as string | null,
  cnpj: null as string | null,
  email: 'contato@haraspro.com.br',
  whatsapp: null as string | null,
  cidade: 'Belo Horizonte, MG',
  /** Data da última revisão das páginas legais. */
  atualizadoEm: '2026-09-08',
} as const

export const TEM_DADOS_LEGAIS = Boolean(EMPRESA.razaoSocial && EMPRESA.cnpj)
