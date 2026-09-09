import { Link } from 'react-router-dom'
import { AlertCircle, Clock } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { iniciais } from '@/components/AnimalCard'
import { PelagemChart } from '@/components/charts/PelagemChart'
import { StatusChart } from '@/components/charts/StatusChart'
import { PartosPrevistos } from '@/components/painel/PartosPrevistos'
import { ResumoCustos } from '@/components/painel/ResumoCustos'
import { SemaforoSanitario } from '@/components/painel/SemaforoSanitario'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { diasAte, formatBRL, formatDate, rotuloPrazo } from '@/lib/format'
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

export default function Dashboard() {
  const { data: stats, loading: carregandoStats } = useAsync(() => store.getStats(), [])
  const { data: animais, loading: carregandoAnimais } = useAsync(
    () => store.getAnimais({ orderBy: 'created_at', ascending: false }),
    [],
  )
  const { data: pendencias, loading: carregandoPendencias } = useAsync(
    () => store.getPendenciasSanitarias(),
    [],
  )
  const { data: partos, loading: carregandoPartos } = useAsync(() => store.getPartosPrevistos(), [])
  const { data: custos, loading: carregandoCustos } = useAsync(() => store.getResumoCustos(), [])

  const eventos = stats?.eventosProximos ?? []
  const recentes = (animais ?? []).slice(0, 5)

  const listaPendencias = pendencias ?? []
  const vencidas = listaPendencias.filter((p) => diasAte(p.proxima_data) < 0).length
  const listaPartos = partos ?? []
  const partosAtrasados = listaPartos.filter((p) => diasAte(p.data_prevista_parto) < 0).length

  return (
    <>
      <PageHeader
        title="Painel do Plantel"
        description={`Mangalarga Marchador · ${new Date().toLocaleDateString('pt-BR')}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carregandoStats || carregandoPendencias || carregandoPartos || carregandoCustos ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard tom="marca" value={stats?.totalAnimais ?? 0} label="Total de animais" />
            <StatCard
              tom={vencidas > 0 ? 'alerta' : 'neutro'}
              value={listaPendencias.length}
              label="Pendências sanitárias"
              detalhe={vencidas > 0 ? `${vencidas} já vencida${vencidas > 1 ? 's' : ''}` : 'tudo em dia'}
            />
            <StatCard
              tom={partosAtrasados > 0 ? 'alerta' : 'neutro'}
              value={listaPartos.length}
              label="Partos previstos"
              detalhe={partosAtrasados > 0 ? `${partosAtrasados} passou da data` : 'próximos 90 dias'}
            />
            <StatCard
              value={formatBRL(custos?.mesAtual ?? 0)}
              label="Custo no mês"
              detalhe={`mês anterior ${formatBRL(custos?.mesAnterior ?? 0)}`}
            />
          </>
        )}
      </div>

      {/* O que exige ação hoje vem antes de qualquer composição do plantel. */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <SemaforoSanitario pendencias={listaPendencias} carregando={carregandoPendencias} />
        <PartosPrevistos partos={listaPartos} carregando={carregandoPartos} />
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <ResumoCustos resumo={custos ?? null} carregando={carregandoCustos} />

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
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Distribuição de pelagens</h2>
          {carregandoAnimais ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <div className="animar-entrada">
              <PelagemChart data={contar((animais ?? []).map((a) => a.pelagem))} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Status reprodutivo</h2>
          {carregandoAnimais ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <div className="animar-entrada">
              <StatusChart data={contar((animais ?? []).map((a) => a.status_reprodutivo))} />
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" />
          Últimos cadastros
        </h2>

        {carregandoAnimais ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : recentes.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Nenhum animal cadastrado.</p>
        ) : (
          /* Em grade, e não em lista: ocupando a largura toda, cinco linhas
             empilhadas deixariam metade do cartão vazia. */
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {recentes.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/animal/${a.id}`}
                  className="border-border hover:bg-secondary flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors"
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
                    <p className="text-muted-foreground truncate text-xs">{a.pelagem}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
