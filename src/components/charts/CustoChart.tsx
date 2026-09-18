import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { EIXO_TICK, TOOLTIP_STYLE } from './chartTheme'
import { formatBRL, rotuloMes } from '@/lib/format'
import type { CustoPorMes } from '@/lib/store'

export function CustoChart({ data }: { data: CustoPorMes[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Sem custos lançados.</p>
  }

  // O eixo recebe o rótulo curto; a chave "AAAA-MM" continua no ponto para
  // manter a ordem cronológica, que a ordenação alfabética do rótulo perderia.
  const pontos = data.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={pontos}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={EIXO_TICK} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={EIXO_TICK}
          width={56}
          tickFormatter={(v) => formatBRL(Number(v))}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--secondary)' }}
          formatter={(v) => [formatBRL(Number(v)), 'Custo']}
        />
        <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
