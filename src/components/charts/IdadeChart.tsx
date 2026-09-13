import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { EIXO_TICK, TOOLTIP_STYLE } from './chartTheme'

export type FaixaIdade = { faixa: string; quantidade: number }

export function IdadeChart({ data }: { data: FaixaIdade[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="faixa" tickLine={false} axisLine={false} tick={EIXO_TICK} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EIXO_TICK} />
        <Tooltip cursor={{ fill: 'var(--secondary)' }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="quantidade" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
