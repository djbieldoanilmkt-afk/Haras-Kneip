/**
 * Estilos compartilhados pelos gráficos.
 *
 * Todos apontam para tokens do tema, não para valores fixos. O
 * js/components/charts.js legado fixava cores de um tema escuro antigo
 * (texto #b8a892, borda #1a1410) sobre fundo claro.
 */

export const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
} as const

export const EIXO_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 } as const

export const LEGENDA_STYLE = { fontSize: 12, color: 'var(--muted-foreground)' } as const

/**
 * Cores de pelagem descrevem a cor real do animal, então continuam fixas —
 * são as mesmas de js/components/charts.js:21-31.
 */
export const PELAGEM_COLORS: Record<string, string> = {
  Castanha: '#8B4513',
  Tordilha: '#A9A9A9',
  Alazã: '#D2691E',
  Baia: '#DAA520',
  Pampa: '#E8D5B7',
  Rosilha: '#CD5C5C',
  Zaina: '#2C1810',
  Preta: '#333333',
  'Tordilha Negra': '#696969',
}

export const STATUS_COLORS: Record<string, string> = {
  Vazia: 'var(--status-vazia)',
  Prenha: 'var(--status-prenha)',
  Lactante: 'var(--status-lactante)',
  'Em Cobertura': 'var(--status-cobertura)',
  'Potro/Potra': 'var(--status-potro)',
}

export type Fatia = { name: string; value: number }
