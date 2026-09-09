/**
 * Planos de assinatura.
 *
 * Valores centralizados aqui de propósito: mexer em preço é decisão de
 * negócio e não deve exigir caçar número dentro de componente. A régua é o
 * número de animais, porque escala junto com o valor entregue — quem tem mais
 * cavalo gasta mais e ganha mais com o controle.
 *
 * IMPORTANTE: não há cobrança automática ainda. O trial e o bloqueio são
 * reais, mas a ativação após o pagamento é manual (status_conta -> 'ativa').
 */

export type Plano = {
  id: 'essencial' | 'haras' | 'plantel'
  nome: string
  precoMensal: number
  /** Anual com dois meses grátis. */
  precoAnual: number
  resumo: string
  animais: string
  usuarios: string
  /**
   * Espelha limite_usuarios() em 007_equipe.sql. null = ilimitado.
   *
   * O número vive nos dois lugares de propósito: aqui para a tela avisar
   * antes de tentar, e no banco para recusar de fato. Se só o front soubesse,
   * bastaria chamar a API direto para furar o limite.
   */
  limiteUsuarios: number | null
  destaque?: boolean
  recursos: string[]
}

export const PLANOS: Plano[] = [
  {
    id: 'essencial',
    nome: 'Essencial',
    precoMensal: 97,
    precoAnual: 970,
    resumo: 'Para quem está saindo da planilha',
    animais: 'Até 15 animais',
    usuarios: '1 usuário',
    limiteUsuarios: 1,
    recursos: [
      'Plantel completo com fotos',
      'Genealogia em três gerações',
      'Calendário e alertas',
      'Saúde e reprodução',
      'Vitrine pública',
      'Relatórios e exportação CSV',
    ],
  },
  {
    id: 'haras',
    nome: 'Haras',
    precoMensal: 247,
    precoAnual: 2470,
    resumo: 'Para o criador que vive disso',
    animais: 'Até 50 animais',
    usuarios: 'Até 3 usuários',
    limiteUsuarios: 3,
    destaque: true,
    recursos: [
      'Tudo do Essencial',
      'Custo por animal',
      'Semáforo de documentos',
      'Indicadores de reprodução',
      'Suporte prioritário',
    ],
  },
  {
    id: 'plantel',
    nome: 'Plantel',
    precoMensal: 497,
    precoAnual: 4970,
    resumo: 'Para haras grande e central de reprodução',
    animais: 'Animais ilimitados',
    usuarios: 'Usuários ilimitados',
    limiteUsuarios: null,
    recursos: [
      'Tudo do Haras',
      'Vários haras na mesma conta',
      'Exportação e integração',
      'Acompanhamento dedicado',
    ],
  },
]

export const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
})
