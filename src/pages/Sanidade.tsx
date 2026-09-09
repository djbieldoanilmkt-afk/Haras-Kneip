import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { toastDesfazer } from '@/components/ui/sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Campo, SelectAnimal, SelectSimples } from '@/components/form/Campo'
import { SemaforoSanitario } from '@/components/painel/SemaforoSanitario'
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
import { useTenant, veFinanceiro } from '@/hooks/tenant'
import { store } from '@/lib/store'
import { TIPOS_SAUDE } from '@/lib/status'
import { diasAte, formatBRL, formatDate } from '@/lib/format'
import { validateSaude } from '@/lib/validators'
import { cn } from '@/lib/utils'

const TODOS = 'Todos os tipos'

function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Sanidade() {
  const { papel } = useTenant()
  const mostraDinheiro = veFinanceiro(papel)

  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState<string>(TODOS)
  const [form, setForm] = useState({
    animal_id: '',
    tipo: TIPOS_SAUDE[0] as string,
    data_registro: hojeISO(),
    descricao: '',
    veterinario: '',
    proxima_data: '',
    custo: '',
    observacoes: '',
  })

  const { data: registros, loading: carregando, reload } = useAsync(
    () => store.getSaudeRegistrosPlantel(),
    [],
  )
  const { data: pendencias, loading: carregandoPendencias, reload: recarregarPendencias } =
    useAsync(() => store.getPendenciasSanitarias(), [])
  const { data: animais } = useAsync(() => store.getAnimais(), [])

  const lista = registros ?? []
  const plantel = animais ?? []
  const listaPendencias = pendencias ?? []
  const vencidas = listaPendencias.filter((p) => diasAte(p.proxima_data) < 0).length

  const filtrada = useMemo(
    () => (filtro === TODOS ? lista : lista.filter((r) => r.tipo === filtro)),
    [lista, filtro],
  )

  const gastoNoPeriodo = lista.reduce((soma, r) => soma + Number(r.custo ?? 0), 0)

  function abrir() {
    setForm({
      animal_id: plantel[0]?.id ?? '',
      tipo: TIPOS_SAUDE[0],
      data_registro: hojeISO(),
      descricao: '',
      veterinario: '',
      proxima_data: '',
      custo: '',
      observacoes: '',
    })
    setErros({})
    setAberto(true)
  }

  async function salvar() {
    const { isValid, errors } = validateSaude(form)
    if (!form.animal_id) errors.animal_id = 'Escolha o animal'
    setErros(errors)
    if (!isValid || !form.animal_id) return

    setSalvando(true)
    try {
      await store.createSaudeRegistro({
        animal_id: form.animal_id,
        tipo: form.tipo,
        data_registro: form.data_registro,
        descricao: form.descricao,
        veterinario: form.veterinario || null,
        proxima_data: form.proxima_data || null,
        custo: form.custo ? Number(form.custo.replace(',', '.')) : null,
        observacoes: form.observacoes || null,
      })
      toast.success('Registro de sanidade salvo.')
      setAberto(false)
      reload()
      recarregarPendencias()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  /** Sem confirmação, com desfazer — mesma escolha do financeiro. */
  async function remover(id: string, rotulo: string) {
    try {
      await store.excluirRegistro('saude_registros', id)
      reload()
      recarregarPendencias()

      toastDesfazer(`${rotulo} excluído.`, async () => {
        try {
          await store.restaurarRegistro('saude_registros', id)
          reload()
          recarregarPendencias()
          toast.success('Registro restaurado.')
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
        title="Sanidade"
        description="Vacinas, vermifugação, exames e tratamentos do plantel"
        actions={
          <Button size="sm" onClick={abrir}>
            <Plus className="size-4" />
            Novo registro
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carregando || carregandoPendencias ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              tom={vencidas > 0 ? 'alerta' : 'neutro'}
              value={vencidas}
              label="Vencidas"
              detalhe={vencidas > 0 ? 'precisam de ação' : 'nada atrasado'}
            />
            <StatCard
              value={listaPendencias.length - vencidas}
              label="Vencem em 30 dias"
              detalhe="dá tempo de agendar"
            />
            <StatCard tom="marca" value={lista.length} label="Registros" detalhe="últimos 12 meses" />
            {mostraDinheiro && (
              <StatCard
                value={formatBRL(gastoNoPeriodo)}
                label="Gasto em sanidade"
                detalhe="últimos 12 meses"
              />
            )}
          </>
        )}
      </div>

      <div className="mb-4">
        <SemaforoSanitario
          pendencias={listaPendencias}
          carregando={carregandoPendencias}
          limite={listaPendencias.length}
          titulo="Vencendo agora"
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Histórico</h2>
          <div className="w-48">
            <SelectSimples
              value={filtro}
              onValueChange={setFiltro}
              options={[TODOS, ...TIPOS_SAUDE]}
            />
          </div>
        </div>

        {carregando ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : filtrada.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {lista.length === 0
              ? 'Nenhum registro de sanidade nos últimos 12 meses.'
              : `Nenhum registro do tipo "${filtro}".`}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {filtrada.map((r) => {
              const retornoVencido = r.proxima_data ? diasAte(r.proxima_data) < 0 : false

              return (
                <li key={r.id} className="flex items-center gap-1">
                  <Link
                    to={`/animal/${r.animal_id}`}
                    className="hover:bg-secondary -mx-2 flex flex-1 items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.animal}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.tipo}
                        {r.descricao ? ` · ${r.descricao}` : ''}
                        {r.veterinario ? ` · ${r.veterinario}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium">{formatDate(r.data_registro)}</p>
                      {r.proxima_data && (
                        <p
                          className={cn(
                            'text-xs',
                            retornoVencido
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground',
                          )}
                        >
                          retorno {formatDate(r.proxima_data)}
                        </p>
                      )}
                    </div>

                    <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                      {r.custo ? formatBRL(Number(r.custo)) : '—'}
                    </span>
                  </Link>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir registro de ${r.animal}`}
                    onClick={() => remover(r.id, `${r.tipo} de ${r.animal}`)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo registro de sanidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Campo label="Animal" erro={erros.animal_id}>
              <SelectAnimal
                value={form.animal_id}
                onValueChange={(v) => setForm((f) => ({ ...f, animal_id: v }))}
                animais={plantel}
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Tipo" erro={erros.tipo}>
                <SelectSimples
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                  options={TIPOS_SAUDE}
                />
              </Campo>

              <Campo label="Data" htmlFor="data_registro" erro={erros.data_registro}>
                <Input
                  id="data_registro"
                  type="date"
                  value={form.data_registro}
                  onChange={(e) => setForm((f) => ({ ...f, data_registro: e.target.value }))}
                />
              </Campo>
            </div>

            <Campo label="Descrição" htmlFor="descricao">
              <Input
                id="descricao"
                placeholder="Influenza + tétano"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Próxima aplicação"
                htmlFor="proxima_data"
                hint="É o que alimenta o semáforo."
              >
                <Input
                  id="proxima_data"
                  type="date"
                  value={form.proxima_data}
                  onChange={(e) => setForm((f) => ({ ...f, proxima_data: e.target.value }))}
                />
              </Campo>

              <Campo label="Custo (R$)" htmlFor="custo">
                <Input
                  id="custo"
                  inputMode="decimal"
                  placeholder="180,00"
                  value={form.custo}
                  onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
                />
              </Campo>
            </div>

            <Campo label="Veterinário" htmlFor="veterinario">
              <Input
                id="veterinario"
                value={form.veterinario}
                onChange={(e) => setForm((f) => ({ ...f, veterinario: e.target.value }))}
              />
            </Campo>

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
              {salvando ? 'Salvando...' : 'Salvar registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
