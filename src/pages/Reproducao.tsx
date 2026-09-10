import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { toastDesfazer } from '@/components/ui/sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Campo, SelectAnimal, SelectSimples } from '@/components/form/Campo'
import { PartosPrevistos } from '@/components/painel/PartosPrevistos'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { METODOS_REPRODUCAO, TIPOS_REPRODUCAO } from '@/lib/status'
import { coberturasPorGaranhao, taxaDeDiagnostico } from '@/lib/reproducao'
import { diasAte, formatDate } from '@/lib/format'
import { validateReproducao } from '@/lib/validators'

const TODOS = 'Todos os tipos'

function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Reproducao() {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState<string>(TODOS)
  const [form, setForm] = useState({
    animal_id: '',
    tipo: TIPOS_REPRODUCAO[0] as string,
    data_evento: hojeISO(),
    garanhao: '',
    metodo: '',
    data_prevista_parto: '',
    resultado: '',
    observacoes: '',
  })

  const { data: eventos, loading: carregando, reload } = useAsync(
    () => store.getReproducaoPlantel(),
    [],
  )
  const { data: partos, loading: carregandoPartos, reload: recarregarPartos } = useAsync(
    () => store.getPartosPrevistos(),
    [],
  )
  const { data: animais } = useAsync(() => store.getAnimais(), [])

  const lista = eventos ?? []
  const plantel = animais ?? []
  const listaPartos = partos ?? []

  const prenhas = plantel.filter((a) => a.status_reprodutivo === 'Prenha').length
  const lactantes = plantel.filter((a) => a.status_reprodutivo === 'Lactante').length
  const atrasados = listaPartos.filter((p) => diasAte(p.data_prevista_parto) < 0).length

  const taxa = taxaDeDiagnostico(lista)
  const porGaranhao = coberturasPorGaranhao(lista)

  const filtrada = useMemo(
    () => (filtro === TODOS ? lista : lista.filter((e) => e.tipo === filtro)),
    [lista, filtro],
  )

  function abrir() {
    setForm({
      animal_id: plantel[0]?.id ?? '',
      tipo: TIPOS_REPRODUCAO[0],
      data_evento: hojeISO(),
      garanhao: '',
      metodo: '',
      data_prevista_parto: '',
      resultado: '',
      observacoes: '',
    })
    setErros({})
    setAberto(true)
  }

  async function salvar() {
    const { isValid, errors } = validateReproducao(form)
    if (!form.animal_id) errors.animal_id = 'Escolha a matriz'
    setErros(errors)
    if (!isValid || !form.animal_id) return

    setSalvando(true)
    try {
      await store.createReproducao({
        animal_id: form.animal_id,
        tipo: form.tipo,
        data_evento: form.data_evento,
        garanhao: form.garanhao || null,
        metodo: form.metodo || null,
        data_prevista_parto: form.data_prevista_parto || null,
        resultado: form.resultado || null,
        observacoes: form.observacoes || null,
      })
      toast.success('Evento reprodutivo salvo.')
      setAberto(false)
      reload()
      recarregarPartos()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  /** Sem confirmação, com desfazer — mesma escolha do financeiro. */
  async function remover(id: string, rotulo: string) {
    try {
      await store.excluirRegistro('reproducao', id)
      reload()
      recarregarPartos()

      toastDesfazer(`${rotulo} excluído.`, async () => {
        try {
          await store.restaurarRegistro('reproducao', id)
          reload()
          recarregarPartos()
          toast.success('Evento restaurado.')
        } catch (e) {
          toast.error(`Não foi possível restaurar: ${e instanceof Error ? e.message : 'erro'}`)
        }
      })
    } catch (e) {
      toast.error(`Erro ao excluir: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }
  }

  return (
    <>
      <PageHeader
        title="Reprodução"
        description="Coberturas, diagnósticos e partos do plantel"
        actions={
          <Button size="sm" onClick={abrir}>
            <Plus className="size-4" />
            Novo evento
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carregando || carregandoPartos ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard tom="marca" value={prenhas} label="Matrizes prenhas" />
            <StatCard value={lactantes} label="Matrizes lactantes" />
            <StatCard
              tom={atrasados > 0 ? 'alerta' : 'neutro'}
              value={listaPartos.length}
              label="Partos previstos"
              detalhe={atrasados > 0 ? `${atrasados} passou da data` : 'próximos 90 dias'}
            />
            <StatCard
              value={taxa.coberturas === 0 ? '—' : `${taxa.percentual}%`}
              label="DG+ por cobertura"
              detalhe={
                taxa.coberturas === 0
                  ? 'sem coberturas no período'
                  : `${taxa.diagnosticos} de ${taxa.coberturas} coberturas`
              }
            />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <PartosPrevistos
          partos={listaPartos}
          carregando={carregandoPartos}
          limite={listaPartos.length}
        />

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Coberturas por garanhão</h2>

          {carregando ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : porGaranhao.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhuma cobertura registrada nos últimos 12 meses.
            </p>
          ) : (
            <ul className="space-y-2">
              {porGaranhao.map((g) => (
                <li key={g.garanhao}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm">{g.garanhao}</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {g.coberturas}
                    </span>
                  </div>
                  <div className="bg-secondary mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${(g.coberturas / porGaranhao[0].coberturas) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Histórico</h2>
          <div className="w-60">
            <SelectSimples
              value={filtro}
              onValueChange={setFiltro}
              options={[TODOS, ...TIPOS_REPRODUCAO]}
            />
          </div>
        </div>

        {carregando ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : filtrada.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {lista.length === 0
              ? 'Nenhum evento reprodutivo nos últimos 12 meses.'
              : `Nenhum evento do tipo "${filtro}".`}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {filtrada.map((e) => (
              <li key={e.id} className="flex items-center gap-1">
                <Link
                  to={`/animal/${e.animal_id}`}
                  className="hover:bg-secondary -mx-2 flex flex-1 items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.matriz}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {e.tipo}
                      {e.garanhao ? ` · ${e.garanhao}` : ''}
                      {e.metodo ? ` · ${e.metodo}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">{formatDate(e.data_evento)}</p>
                    {e.data_prevista_parto && (
                      <p className="text-muted-foreground text-xs">
                        parto {formatDate(e.data_prevista_parto)}
                      </p>
                    )}
                  </div>

                  {e.resultado && (
                    <span className="text-muted-foreground w-24 shrink-0 truncate text-right text-xs">
                      {e.resultado}
                    </span>
                  )}
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir evento de ${e.matriz}`}
                  onClick={() => remover(e.id, `${e.tipo} de ${e.matriz}`)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo evento reprodutivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Campo label="Matriz" erro={erros.animal_id}>
              <SelectAnimal
                value={form.animal_id}
                onValueChange={(v) => setForm((f) => ({ ...f, animal_id: v }))}
                animais={plantel}
                placeholder="Selecione a matriz..."
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Tipo" erro={erros.tipo}>
                <SelectSimples
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                  options={TIPOS_REPRODUCAO}
                />
              </Campo>

              <Campo label="Data" htmlFor="data_evento" erro={erros.data_evento}>
                <Input
                  id="data_evento"
                  type="date"
                  value={form.data_evento}
                  onChange={(e) => setForm((f) => ({ ...f, data_evento: e.target.value }))}
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Garanhão" htmlFor="garanhao">
                <Input
                  id="garanhao"
                  value={form.garanhao}
                  onChange={(e) => setForm((f) => ({ ...f, garanhao: e.target.value }))}
                />
              </Campo>

              {/* Select, e não texto livre: o banco só aceita estes três. */}
              <Campo label="Método">
                <SelectSimples
                  value={form.metodo}
                  onValueChange={(v) => setForm((f) => ({ ...f, metodo: v }))}
                  options={METODOS_REPRODUCAO}
                  placeholder="Não informado"
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Parto previsto"
                htmlFor="data_prevista_parto"
                hint="Cerca de 340 dias após a cobertura."
              >
                <Input
                  id="data_prevista_parto"
                  type="date"
                  value={form.data_prevista_parto}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data_prevista_parto: e.target.value }))
                  }
                />
              </Campo>

              <Campo label="Resultado" htmlFor="resultado">
                <Input
                  id="resultado"
                  value={form.resultado}
                  onChange={(e) => setForm((f) => ({ ...f, resultado: e.target.value }))}
                />
              </Campo>
            </div>

            <Campo label="Observações" htmlFor="observacoes">
              <Textarea
                id="observacoes"
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </Campo>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
