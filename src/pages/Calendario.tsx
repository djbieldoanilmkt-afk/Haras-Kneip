import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Campo, SelectSimples } from '@/components/form/Campo'
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
import { formatDate } from '@/lib/format'
import { TIPOS_EVENTO, eventoClasse } from '@/lib/status'
import { validateEvento } from '@/lib/validators'
import { cn } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const SEM_ANIMAL = 'Nenhum'
const hojeISO = () => new Date().toISOString().slice(0, 10)

function dataISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export default function Calendario() {
  const [mesAtual, setMesAtual] = useState(() => new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    titulo: '',
    tipo: TIPOS_EVENTO[0] as string,
    data_evento: hojeISO(),
    animal: SEM_ANIMAL,
    descricao: '',
  })

  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth()

  const { data: eventos, loading, reload } = useAsync(
    () => store.getEventos(mes + 1, ano),
    [ano, mes],
  )
  const { data: animais } = useAsync(() => store.getAnimais(), [])

  const porDia = useMemo(() => {
    const mapa: Record<string, typeof eventos> = {}
    for (const e of eventos ?? []) {
      const chave = e.data_evento.slice(0, 10)
      ;(mapa[chave] ??= []).push(e)
    }
    return mapa
  }, [eventos])

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const hoje = hojeISO()

  const eventosDoDia = diaSelecionado ? (porDia[diaSelecionado] ?? []) : []

  function mudarMes(delta: number) {
    setMesAtual(new Date(ano, mes + delta, 1))
    setDiaSelecionado(null)
  }

  async function salvar() {
    const { isValid, errors } = validateEvento(form)
    setErros(errors)
    if (!isValid) return

    setSalvando(true)
    try {
      const animalId = animais?.find((a) => a.nome === form.animal)?.id ?? null
      await store.createEvento({
        titulo: form.titulo,
        tipo: form.tipo,
        data_evento: form.data_evento,
        animal_id: animalId,
        descricao: form.descricao || null,
        concluido: false,
      })
      toast.success('Evento criado.')
      setAberto(false)
      setForm((f) => ({ ...f, titulo: '', descricao: '' }))
      reload()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Calendário"
        description={`${MESES[mes]} de ${ano}`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMesAtual(new Date())}>
              Hoje
            </Button>
            <Button size="sm" onClick={() => setAberto(true)}>
              <Plus className="size-4" />
              Novo evento
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-muted-foreground mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium">
            {DIAS_SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {loading ? (
            <Skeleton className="h-[420px] rounded-lg" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: primeiroDiaSemana }, (_, i) => (
                <div key={`vazio-${i}`} />
              ))}

              {Array.from({ length: diasNoMes }, (_, i) => {
                const dia = i + 1
                const iso = dataISO(ano, mes, dia)
                const doDia = porDia[iso] ?? []
                const ehHoje = iso === hoje

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setDiaSelecionado(iso)}
                    aria-label={`${dia} de ${MESES[mes]}, ${doDia.length} evento(s)`}
                    aria-pressed={diaSelecionado === iso}
                    className={cn(
                      'border-border hover:bg-secondary min-h-16 rounded-md border p-1.5 text-left transition-colors',
                      ehHoje && 'border-primary border-2',
                      diaSelecionado === iso && 'bg-accent',
                    )}
                  >
                    <span className={cn('text-xs font-semibold', ehHoje && 'text-primary')}>
                      {dia}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-0.5">
                      {doDia.map((e) => (
                        <span
                          key={e.id}
                          className={cn('size-1.5 rounded-full', eventoClasse(e.tipo))}
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {TIPOS_EVENTO.map((tipo) => (
              <span key={tipo} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', eventoClasse(tipo))} />
                {tipo}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {diaSelecionado ? `Eventos em ${formatDate(diaSelecionado)}` : 'Eventos do dia'}
          </h2>

          {!diaSelecionado ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Selecione um dia para ver os eventos.
            </p>
          ) : eventosDoDia.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Nenhum evento neste dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventosDoDia.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    'border-border rounded-md border border-l-4 p-3',
                    eventoClasse(e.tipo).replace('bg-', 'border-l-'),
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{e.titulo}</h3>
                    {e.concluido && (
                      <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                        Concluído
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{e.tipo}</p>
                  {e.descricao && <p className="mt-1.5 text-sm">{e.descricao}</p>}
                  {e.animal_id && (
                    <Link
                      to={`/animal/${e.animal_id}`}
                      className="text-primary mt-1.5 inline-block text-xs hover:underline"
                    >
                      Ver animal
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Título" htmlFor="ev-titulo" erro={erros.titulo}>
              <Input
                id="ev-titulo"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Vacinação anual"
              />
            </Campo>
            <Campo label="Tipo">
              <SelectSimples
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                options={TIPOS_EVENTO}
              />
            </Campo>
            <Campo label="Data" htmlFor="ev-data" erro={erros.data_evento}>
              <Input
                id="ev-data"
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm((f) => ({ ...f, data_evento: e.target.value }))}
              />
            </Campo>
            <Campo label="Animal (opcional)">
              <SelectSimples
                value={form.animal}
                onValueChange={(v) => setForm((f) => ({ ...f, animal: v }))}
                options={[SEM_ANIMAL, ...(animais ?? []).map((a) => a.nome)]}
              />
            </Campo>
            <Campo label="Descrição" htmlFor="ev-desc">
              <Textarea
                id="ev-desc"
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
