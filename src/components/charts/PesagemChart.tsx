import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EIXO_TICK, TOOLTIP_STYLE } from './chartTheme'

export type PontoPesagem = { data: string; peso: number }

export function PesagemChart({ data }: { data: PontoPesagem[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Sem registros de peso.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="pesoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="data" tickLine={false} axisLine={false} tick={EIXO_TICK} />
        <YAxis tickLine={false} axisLine={false} tick={EIXO_TICK} width={44} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} kg`, 'Peso']} />
        <Area
          type="monotone"
          dataKey="peso"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#pesoFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
