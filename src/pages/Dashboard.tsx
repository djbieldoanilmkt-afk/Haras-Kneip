import { Link } from 'react-router-dom'
import { AlertCircle, ChevronRight, Clock } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { iniciais } from '@/components/AnimalCard'
import { PelagemChart } from '@/components/charts/PelagemChart'
import { StatusChart } from '@/components/charts/StatusChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Agrupa valores repetidos numa lista de fatias para os gráficos. */
function contar(valores: (string | null)[]): { name: string; value: number }[] {
  const acumulado: Record<string, number> = {}
  for (const valor of valores) {
    if (!valor) continue
    acumulado[valor] = (acumulado[valor] ?? 0) + 1
  }
  return Object.entries(acumulado).map(([name, value]) => ({ name, value }))
}

/** Dias inteiros entre hoje e a data do evento. */
function diasAte(data: string): number {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number)
  const alvo = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

function rotuloPrazo(dias: number): string {
  if (dias < 0) return 'Atrasado'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias} dias`
}

export default function Dashboard() {
  const { data: stats, loading: carregandoStats } = useAsync(() => store.getStats(), [])
  const { data: animais, loading: carregandoAnimais } = useAsync(
    () => store.getAnimais({ orderBy: 'created_at', ascending: false }),
    [],
  )

  const eventos = stats?.eventosProximos ?? []
  const recentes = (animais ?? []).slice(0, 5)

  return (
    <>
      <PageHeader
        title="Painel do Plantel"
        description={`Mangalarga Marchador · ${new Date().toLocaleDateString('pt-BR')}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carregandoStats ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard highlight value={stats?.totalAnimais ?? 0} label="Total de animais" />
            <StatCard value={stats?.prenhas ?? 0} label="Matrizes prenhas" />
            <StatCard value={stats?.lactantes ?? 0} label="Matrizes lactantes" />
            <StatCard value={eventos.length} label="Eventos em 7 dias" />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Distribuição de pelagens</h2>
          {carregandoAnimais ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <PelagemChart data={contar((animais ?? []).map((a) => a.pelagem))} />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Status reprodutivo</h2>
          {carregandoAnimais ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <StatusChart data={contar((animais ?? []).map((a) => a.status_reprodutivo))} />
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="text-destructive size-4" />
              Eventos próximos
            </h2>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/calendario" />}>
              Ver todos
            </Button>
          </div>

          {carregandoStats ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : eventos.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Nenhum evento próximo.</p>
          ) : (
            <ul className="divide-border divide-y">
              {eventos.slice(0, 5).map((e) => {
                const dias = diasAte(e.data_evento)
                return (
                  <li key={e.id}>
                    <Link
                      to={e.animal_id ? `/animal/${e.animal_id}` : '/calendario'}
                      className="hover:bg-secondary -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'truncate text-sm font-medium',
                            dias <= 2 && 'text-destructive',
                            dias > 2 && dias <= 5 && 'text-primary',
                          )}
                        >
                          {e.titulo}
                        </p>
                        <p className="text-muted-foreground text-xs">{e.tipo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium">{formatDate(e.data_evento)}</p>
                        <p className="text-muted-foreground text-xs">{rotuloPrazo(dias)}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4" />
            Últimos cadastros
          </h2>

          {carregandoAnimais ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : recentes.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhum animal cadastrado.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {recentes.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/animal/${a.id}`}
                    className="hover:bg-secondary -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                  >
                    <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold">
                      {a.foto_url ? (
                        <img src={a.foto_url} alt="" className="size-full object-cover" />
                      ) : (
                        iniciais(a.nome)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nome}</p>
                      <p className="text-muted-foreground text-xs">{a.pelagem}</p>
                    </div>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
