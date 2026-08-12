import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { PelagemChart } from '@/components/charts/PelagemChart'
import { StatusChart } from '@/components/charts/StatusChart'
import { IdadeChart } from '@/components/charts/IdadeChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import type { Animal } from '@/lib/database.types'

/** Faixas e classificação idênticas às de js/pages/reports.js:47-68. */
const FAIXAS = ['0-1', '1-3', '3-5', '5-10', '10+'] as const

function faixaDe(anos: number): (typeof FAIXAS)[number] {
  if (anos <= 1) return '0-1'
  if (anos <= 3) return '1-3'
  if (anos <= 5) return '3-5'
  if (anos <= 10) return '5-10'
  return '10+'
}

function anosCompletos(dataNascimento: string): number {
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number)
  const hoje = new Date()
  let anos = hoje.getFullYear() - ano
  const mesAtual = hoje.getMonth() + 1
  if (mesAtual < mes || (mesAtual === mes && hoje.getDate() < dia)) anos--
  return anos
}

const COLUNAS_CSV = [
  'id', 'nome', 'registro', 'raca', 'pelagem', 'sexo',
  'data_nascimento', 'peso', 'altura', 'baia_piquete',
  'status_reprodutivo', 'status_saude',
] as const

function exportarCsv(animais: Animal[]) {
  if (animais.length === 0) {
    toast.error('Não há animais para exportar.')
    return
  }

  const linhas = animais.map((a) =>
    COLUNAS_CSV.map((c) => `"${String(a[c] ?? '').replace(/"/g, '""')}"`).join(','),
  )
  const csv = [COLUNAS_CSV.join(','), ...linhas].join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'haras_animais.csv'
  link.click()
  URL.revokeObjectURL(url)
  toast.success(`${animais.length} animais exportados.`)
}

function contar(valores: (string | null)[]) {
  const acumulado: Record<string, number> = {}
  for (const v of valores) {
    if (!v) continue
    acumulado[v] = (acumulado[v] ?? 0) + 1
  }
  return Object.entries(acumulado).map(([name, value]) => ({ name, value }))
}

export default function Relatorios() {
  const { data: animais, loading } = useAsync(() => store.getAnimais(), [])
  const lista = useMemo(() => animais ?? [], [animais])

  const resumo = useMemo(() => {
    const comIdade = lista.filter((a) => a.data_nascimento)
    const somaIdades = comIdade.reduce((s, a) => s + anosCompletos(a.data_nascimento!), 0)

    const distribuicao = Object.fromEntries(FAIXAS.map((f) => [f, 0])) as Record<string, number>
    for (const a of comIdade) {
      distribuicao[faixaDe(anosCompletos(a.data_nascimento!))]++
    }

    return {
      total: lista.length,
      femeas: lista.filter((a) => a.sexo === 'Fêmea').length,
      machos: lista.filter((a) => a.sexo === 'Macho').length,
      idadeMedia: comIdade.length > 0 ? (somaIdades / comIdade.length).toFixed(1) : '0.0',
      idades: FAIXAS.map((faixa) => ({ faixa, quantidade: distribuicao[faixa] })),
    }
  }, [lista])

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Visão geral do plantel"
        actions={
          <Button size="sm" onClick={() => exportarCsv(lista)} disabled={loading}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard highlight value={resumo.total} label="Total de animais" />
            <StatCard value={resumo.femeas} label="Fêmeas" />
            <StatCard value={resumo.machos} label="Machos" />
            <StatCard value={resumo.idadeMedia} label="Idade média (anos)" />
          </>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Distribuição de pelagens</h2>
          {loading ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <PelagemChart data={contar(lista.map((a) => a.pelagem))} />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Status reprodutivo</h2>
          {loading ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <StatusChart data={contar(lista.map((a) => a.status_reprodutivo))} />
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Distribuição por idade</h2>
          {loading ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <IdadeChart data={resumo.idades} />
          )}
        </Card>
      </div>
    </>
  )
}
