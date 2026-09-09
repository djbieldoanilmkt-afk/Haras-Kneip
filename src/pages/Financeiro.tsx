import { useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { toastDesfazer } from '@/components/ui/sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Campo, SelectSimples } from '@/components/form/Campo'
import { CustoChart } from '@/components/charts/CustoChart'
import { SeletorRateio } from '@/components/financeiro/SeletorRateio'
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
import { CATEGORIAS_DESPESA } from '@/lib/categorias'
import { formatBRL, formatDate } from '@/lib/format'
import { validateDespesa } from '@/lib/validators'

/** Data de hoje no calendário local, para o valor inicial do formulário. */
function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
}

const FORM_VAZIO = {
  data: hojeISO(),
  categoria: CATEGORIAS_DESPESA[0] as string,
  descricao: '',
  valor: '',
  fornecedor: '',
  observacoes: '',
}

export default function Financeiro() {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState(FORM_VAZIO)
  const [rateio, setRateio] = useState<string[]>([])

  const { data: resumo, loading: carregandoResumo, reload: recarregarResumo } = useAsync(
    () => store.getResumoCustos(),
    [],
  )
  const { data: despesas, loading: carregandoDespesas, reload: recarregarDespesas } = useAsync(
    () => store.getDespesas(),
    [],
  )
  const { data: animais } = useAsync(() => store.getAnimais(), [])

  const lista = despesas ?? []
  const plantel = animais ?? []
  const valorNumerico = Number(form.valor.replace(',', '.')) || 0

  const custoMedio =
    plantel.length > 0 ? (resumo?.mesAtual ?? 0) / plantel.length : 0

  function abrir() {
    setForm(FORM_VAZIO)
    setRateio([])
    setErros({})
    setAberto(true)
  }

  async function salvar() {
    const { isValid, errors } = validateDespesa(form)
    setErros(errors)
    if (!isValid) return

    setSalvando(true)
    try {
      await store.createDespesa(
        {
          data: form.data,
          categoria: form.categoria,
          descricao: form.descricao.trim(),
          valor: valorNumerico,
          fornecedor: form.fornecedor.trim() || null,
          observacoes: form.observacoes.trim() || null,
        },
        rateio,
      )
      toast.success(
        rateio.length > 1
          ? `Despesa lançada e rateada entre ${rateio.length} animais.`
          : rateio.length === 1
            ? 'Despesa lançada e atribuída a 1 animal.'
            : 'Despesa lançada.',
      )
      setAberto(false)
      recarregarResumo()
      recarregarDespesas()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Sem confirmação, com desfazer.
   *
   * O diálogo de confirmação cobra atenção antes de todo mundo, inclusive de
   * quem acertou — e a pessoa acaba clicando "sim" no automático, que é
   * justamente quando o engano passa. O desfazer cobra atenção só de quem
   * errou, e é o que o agente de WhatsApp vai precisar quando entender mal um
   * áudio.
   */
  async function remover(id: string, descricao: string) {
    try {
      await store.excluirRegistro('despesas', id)
      recarregarResumo()
      recarregarDespesas()

      toastDesfazer(`"${descricao}" excluída.`, async () => {
        try {
          await store.restaurarRegistro('despesas', id)
          recarregarResumo()
          recarregarDespesas()
          toast.success('Despesa restaurada.')
        } catch (e) {
          toast.error(`Não foi possível restaurar: ${e instanceof Error ? e.message : 'erro'}`)
        }
      })
    } catch (e) {
      toast.error(`Erro ao excluir: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }
  }

  const maiorCategoria = resumo?.porCategoria[0]

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Despesas do haras e custo por animal"
        actions={
          <Button size="sm" onClick={abrir}>
            <Plus className="size-4" />
            Nova despesa
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {carregandoResumo ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              tom="marca"
              value={formatBRL(resumo?.mesAtual ?? 0)}
              label="Gasto no mês"
              detalhe={`mês anterior ${formatBRL(resumo?.mesAnterior ?? 0)}`}
            />
            <StatCard
              value={formatBRL(custoMedio)}
              label="Custo médio por animal"
              detalhe={`${plantel.length} no plantel`}
            />
            <StatCard
              value={maiorCategoria ? formatBRL(maiorCategoria.total) : formatBRL(0)}
              label="Maior categoria"
              detalhe={maiorCategoria?.categoria ?? 'sem lançamentos'}
            />
          </>
        )}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Gasto por mês</h2>
          {carregandoResumo ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : (
            <div className="animar-entrada">
              <CustoChart data={resumo?.porMes ?? []} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Por categoria</h2>
          {carregandoResumo ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : (resumo?.porCategoria.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Nenhuma despesa lançada nos últimos 6 meses.
            </p>
          ) : (
            <ul className="space-y-2">
              {resumo?.porCategoria.map((c) => (
                <li key={c.categoria}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm">{c.categoria}</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatBRL(c.total)}
                    </span>
                  </div>
                  <div className="bg-secondary mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${
                          (resumo.porCategoria[0]?.total ?? 0) > 0
                            ? (c.total / resumo.porCategoria[0].total) * 100
                            : 0
                        }%`,
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
        <h2 className="mb-3 text-sm font-semibold">Lançamentos</h2>

        {carregandoDespesas ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : lista.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma despesa lançada. Comece pela ração do mês.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {lista.map((d) => (
              <li key={d.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.descricao}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatDate(d.data)} · {d.categoria}
                    {d.fornecedor ? ` · ${d.fornecedor}` : ''}
                  </p>
                  {d.rateios.length > 0 && (
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <Users className="size-3" />
                      Rateada entre {d.rateios.length}{' '}
                      {d.rateios.length > 1 ? 'animais' : 'animal'} ·{' '}
                      {formatBRL(d.rateios[0]?.valor ?? 0)} cada
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatBRL(d.valor)}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${d.descricao}`}
                  onClick={() => remover(d.id, d.descricao)}
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
            <DialogTitle>Nova despesa</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Data" htmlFor="data" erro={erros.data}>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                />
              </Campo>

              <Campo label="Valor (R$)" htmlFor="valor" erro={erros.valor}>
                <Input
                  id="valor"
                  inputMode="decimal"
                  placeholder="1200,00"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </Campo>
            </div>

            <Campo label="Categoria" erro={erros.categoria}>
              <SelectSimples
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
                options={CATEGORIAS_DESPESA}
              />
            </Campo>

            <Campo label="Descrição" htmlFor="descricao" erro={erros.descricao}>
              <Input
                id="descricao"
                placeholder="Ração do mês"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>

            <Campo label="Fornecedor" htmlFor="fornecedor">
              <Input
                id="fornecedor"
                placeholder="Opcional"
                value={form.fornecedor}
                onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
              />
            </Campo>

            <Campo
              label="Ratear entre animais"
              hint="Deixe vazio para uma despesa geral do haras."
            >
              <SeletorRateio
                animais={plantel}
                selecionados={rateio}
                onChange={setRateio}
                valorTotal={valorNumerico}
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
              {salvando ? 'Salvando...' : 'Lançar despesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
