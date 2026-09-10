import { useState } from 'react'
import { Plus, Trash2, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'

import { toastDesfazer } from '@/components/ui/sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Campo, SelectAnimal, SelectSimples } from '@/components/form/Campo'
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
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '@/lib/categorias'
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

const FORM_RECEITA_VAZIO = {
  data: hojeISO(),
  categoria: CATEGORIAS_RECEITA[0] as string,
  descricao: '',
  valor: '',
  cliente: '',
  animal_id: '',
  forma_pagamento: '',
}

export default function Financeiro() {
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState(FORM_VAZIO)
  const [rateio, setRateio] = useState<string[]>([])
  const [receitaAberta, setReceitaAberta] = useState(false)
  const [salvandoReceita, setSalvandoReceita] = useState(false)
  const [errosReceita, setErrosReceita] = useState<Record<string, string>>({})
  const [formReceita, setFormReceita] = useState(FORM_RECEITA_VAZIO)

  const { data: resumo, loading: carregandoResumo, reload: recarregarResumo } = useAsync(
    () => store.getResumoCustos(),
    [],
  )
  const { data: despesas, loading: carregandoDespesas, reload: recarregarDespesas } = useAsync(
    () => store.getDespesas(),
    [],
  )
  const { data: animais } = useAsync(() => store.getAnimais(), [])
  const { data: receitas, loading: carregandoReceitas, reload: recarregarReceitas } = useAsync(
    () => store.getReceitas(),
    [],
  )
  const { data: caixa, loading: carregandoCaixa, reload: recarregarCaixa } = useAsync(
    () => store.getResumoFinanceiro(),
    [],
  )

  const lista = despesas ?? []
  const listaReceitas = receitas ?? []
  const plantel = animais ?? []
  const valorNumerico = Number(form.valor.replace(',', '.')) || 0
  const valorReceita = Number(formReceita.valor.replace(',', '.')) || 0

  function abrirReceita() {
    setFormReceita(FORM_RECEITA_VAZIO)
    setErrosReceita({})
    setReceitaAberta(true)
  }

  async function salvarReceita() {
    const problemas: Record<string, string> = {}
    if (!formReceita.descricao.trim()) problemas.descricao = 'Descreva a entrada.'
    if (valorReceita <= 0) problemas.valor = 'Informe um valor maior que zero.'
    if (!formReceita.data) problemas.data = 'Informe a data.'
    setErrosReceita(problemas)
    if (Object.keys(problemas).length > 0) return

    setSalvandoReceita(true)
    try {
      await store.createReceita({
        data: formReceita.data,
        categoria: formReceita.categoria,
        descricao: formReceita.descricao.trim(),
        valor: valorReceita,
        cliente: formReceita.cliente.trim() || null,
        animal_id: formReceita.animal_id || null,
        forma_pagamento: formReceita.forma_pagamento.trim() || null,
      })
      toast.success('Receita lançada.')
      setReceitaAberta(false)
      recarregarReceitas()
      recarregarCaixa()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvandoReceita(false)
    }
  }

  async function removerReceita(id: string, descricao: string) {
    try {
      await store.excluirRegistro('receitas', id)
      recarregarReceitas()
      recarregarCaixa()

      toastDesfazer(`"${descricao}" excluída.`, async () => {
        try {
          await store.restaurarRegistro('receitas', id)
          recarregarReceitas()
          recarregarCaixa()
          toast.success('Receita restaurada.')
        } catch (e) {
          toast.error(`Não foi possível restaurar: ${e instanceof Error ? e.message : 'erro'}`)
        }
      })
    } catch (e) {
      toast.error(`Erro ao excluir: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }
  }

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

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Entradas, saídas e custo por animal"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={abrirReceita}>
              <TrendingUp className="size-4" />
              Nova receita
            </Button>
            <Button size="sm" onClick={abrir}>
              <Plus className="size-4" />
              Nova despesa
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {carregandoCaixa || carregandoResumo ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              value={formatBRL(caixa?.receitas ?? 0)}
              label="Entrou no mês"
              detalhe="vendas, coberturas e serviços"
            />
            <StatCard
              value={formatBRL(caixa?.despesas ?? 0)}
              label="Saiu no mês"
              detalhe={`mês anterior ${formatBRL(resumo?.mesAnterior ?? 0)}`}
            />
            {/*
              O saldo é a única linha que responde "o haras deu lucro?". Fica
              em destaque, e muda de tom quando fecha no vermelho — um número
              negativo em cinza passa despercebido justamente no mês em que
              importa.
            */}
            <StatCard
              tom={(caixa?.saldo ?? 0) < 0 ? 'alerta' : 'marca'}
              value={formatBRL(caixa?.saldo ?? 0)}
              label="Saldo do mês"
              detalhe={(caixa?.saldo ?? 0) < 0 ? 'fechando no vermelho' : 'entradas menos saídas'}
            />
            <StatCard
              value={formatBRL(custoMedio)}
              label="Custo médio por animal"
              detalhe={`${plantel.length} no plantel`}
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

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">Receitas</h2>

        {carregandoReceitas ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : listaReceitas.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma entrada lançada. Venda de animal, cobertura e hospedagem entram aqui.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {listaReceitas.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.descricao}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatDate(r.data)} · {r.categoria}
                    {r.cliente ? ` · ${r.cliente}` : ''}
                    {r.animal ? ` · ${r.animal}` : ''}
                  </p>
                </div>

                {/*
                  O sinal de mais não é enfeite: numa lista de números todos
                  pretos, receita e despesa se confundem à primeira vista.
                */}
                <span className="text-primary shrink-0 text-sm font-medium tabular-nums">
                  + {formatBRL(r.valor)}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${r.descricao}`}
                  onClick={() => removerReceita(r.id, r.descricao)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={receitaAberta} onOpenChange={setReceitaAberta}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova receita</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Data" htmlFor="receita-data" erro={errosReceita.data}>
                <Input
                  id="receita-data"
                  type="date"
                  value={formReceita.data}
                  onChange={(e) => setFormReceita((f) => ({ ...f, data: e.target.value }))}
                />
              </Campo>

              <Campo label="Categoria" htmlFor="receita-categoria">
                <SelectSimples
                  id="receita-categoria"
                  value={formReceita.categoria}
                  onValueChange={(v) => setFormReceita((f) => ({ ...f, categoria: v }))}
                  options={CATEGORIAS_RECEITA}
                />
              </Campo>
            </div>

            <Campo label="Descrição" htmlFor="receita-descricao" erro={errosReceita.descricao}>
              <Input
                id="receita-descricao"
                value={formReceita.descricao}
                placeholder="Venda da potra Fumaça"
                onChange={(e) => setFormReceita((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Valor (R$)" htmlFor="receita-valor" erro={errosReceita.valor}>
                <Input
                  id="receita-valor"
                  inputMode="decimal"
                  value={formReceita.valor}
                  placeholder="15000"
                  onChange={(e) => setFormReceita((f) => ({ ...f, valor: e.target.value }))}
                />
              </Campo>

              <Campo label="Cliente" htmlFor="receita-cliente">
                <Input
                  id="receita-cliente"
                  value={formReceita.cliente}
                  placeholder="Quem pagou"
                  onChange={(e) => setFormReceita((f) => ({ ...f, cliente: e.target.value }))}
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Animal (opcional)" htmlFor="receita-animal">
                <SelectAnimal
                  id="receita-animal"
                  value={formReceita.animal_id}
                  onValueChange={(v) => setFormReceita((f) => ({ ...f, animal_id: v }))}
                  animais={plantel}
                  placeholder="Nenhum"
                />
              </Campo>

              <Campo label="Forma de pagamento" htmlFor="receita-forma">
                <Input
                  id="receita-forma"
                  value={formReceita.forma_pagamento}
                  placeholder="Pix, dinheiro, parcelado"
                  onChange={(e) =>
                    setFormReceita((f) => ({ ...f, forma_pagamento: e.target.value }))
                  }
                />
              </Campo>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceitaAberta(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarReceita} disabled={salvandoReceita}>
              {salvandoReceita ? 'Salvando…' : 'Lançar receita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
