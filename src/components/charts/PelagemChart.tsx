import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { LEGENDA_STYLE, PELAGEM_COLORS, TOOLTIP_STYLE, type Fatia } from './chartTheme'

export function PelagemChart({ data }: { data: Fatia[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Sem dados de pelagem.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="60%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={PELAGEM_COLORS[d.name] ?? 'var(--primary)'}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={LEGENDA_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  )
}
