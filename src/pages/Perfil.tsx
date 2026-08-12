import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, MapPin, Pencil, Plus, Ruler, Scale, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { PedigreeTree } from '@/components/PedigreeTree'
import { iniciais } from '@/components/AnimalCard'
import { PesagemChart } from '@/components/charts/PesagemChart'
import { Campo, SelectSimples } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { calcularIdade, formatDate } from '@/lib/format'
import { TIPOS_REPRODUCAO, TIPOS_SAUDE } from '@/lib/status'
import { validateReproducao, validateSaude } from '@/lib/validators'
import type { Animal } from '@/lib/database.types'

const hojeISO = () => new Date().toISOString().slice(0, 10)

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-10 text-center text-sm">{children}</p>
}

function CabecalhoAba({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {acao}
    </div>
  )
}

// ---------------------------------------------------------------- informações

function AbaInformacoes({ animal }: { animal: Animal }) {
  const { data: pesagens, loading, reload } = useAsync(() => store.getPesagens(animal.id), [animal.id])
  const [aberto, setAberto] = useState(false)
  const [data, setData] = useState(hojeISO())
  const [peso, setPeso] = useState('')
  const [salvando, setSalvando] = useState(false)

  const detalhes: [string, string][] = [
    ['Nome', animal.nome],
    ['Apelido', animal.apelido || '--'],
    ['Registro ABCCMM', animal.registro_abccmm || '--'],
    ['Registro interno', animal.registro || '--'],
    ['Data de nascimento', animal.data_nascimento ? formatDate(animal.data_nascimento) : '--'],
    ['Sexo', animal.sexo === 'Fêmea' ? 'Égua' : 'Garanhão'],
    ['Pelagem', animal.pelagem || '--'],
    ['Tipo de marcha', animal.tipo_marcha || '--'],
    ['Premiações', animal.premiacao || '--'],
  ]

  async function salvar() {
    const valor = Number(peso)
    if (!data || !Number.isFinite(valor) || valor <= 0) {
      toast.error('Informe uma data e um peso válido.')
      return
    }
    setSalvando(true)
    try {
      await store.createPesagem({ animal_id: animal.id, data_pesagem: data, peso: valor })
      toast.success('Pesagem registrada.')
      setAberto(false)
      setPeso('')
      reload()
    } catch (e) {
      toast.error(`Erro ao registrar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <CabecalhoAba titulo="Detalhes" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {detalhes.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">{rotulo}</dt>
              <dd className="mt-0.5 text-sm">{valor}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Observações
            </dt>
            <dd className="mt-0.5 text-sm whitespace-pre-wrap">{animal.observacoes || '--'}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4">
        <CabecalhoAba
          titulo="Histórico de peso"
          acao={
            <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
              <Plus className="size-4" />
              Registrar
            </Button>
          }
        />
        {loading ? (
          <Skeleton className="h-[240px] rounded-lg" />
        ) : (
          <PesagemChart
            data={(pesagens ?? []).map((p) => ({
              data: formatDate(p.data_pesagem),
              peso: Number(p.peso),
            }))}
          />
        )}
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pesagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Data" htmlFor="peso-data">
              <Input
                id="peso-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Campo>
            <Campo label="Peso (kg)" htmlFor="peso-valor">
              <Input
                id="peso-valor"
                type="number"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ex: 450"
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
    </div>
  )
}

// ---------------------------------------------------------------- genealogia

function AbaGenealogia({ animal }: { animal: Animal }) {
  const { data, loading, reload } = useAsync(
    () => Promise.all([store.getGenealogia(animal.id), store.getAnimaisMap(), store.getAnimais()]),
    [animal.id],
  )
  const [aberto, setAberto] = useState(false)
  const [paiId, setPaiId] = useState('')
  const [maeId, setMaeId] = useState('')
  const [salvando, setSalvando] = useState(false)

  const genealogia = data?.[0] ?? null
  const mapa = data?.[1] ?? {}
  const todos = data?.[2] ?? []

  const nomes = Object.fromEntries(Object.entries(mapa).map(([id, a]) => [id, a.nome]))
  const machos = todos.filter((a) => a.sexo === 'Macho' && a.id !== animal.id)
  const femeas = todos.filter((a) => a.sexo === 'Fêmea' && a.id !== animal.id)

  const DESCONHECIDO = 'Desconhecido'
  const nomeDe = (id: string | null) => (id && nomes[id]) || DESCONHECIDO
  const idDe = (lista: Animal[], nome: string) => lista.find((a) => a.nome === nome)?.id ?? null

  function abrir() {
    setPaiId(nomeDe(genealogia?.pai_id ?? null))
    setMaeId(nomeDe(genealogia?.mae_id ?? null))
    setAberto(true)
  }

  async function salvar() {
    setSalvando(true)
    try {
      await store.saveGenealogia({
        ...(genealogia?.id ? { id: genealogia.id } : {}),
        animal_id: animal.id,
        pai_id: idDe(machos, paiId),
        mae_id: idDe(femeas, maeId),
      })
      toast.success('Genealogia atualizada.')
      setAberto(false)
      reload()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-4">
      <CabecalhoAba
        titulo="Árvore genealógica"
        acao={
          <Button variant="outline" size="sm" onClick={abrir} disabled={loading}>
            <Pencil className="size-4" />
            Editar genealogia
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : (
        <PedigreeTree genealogia={genealogia} nomes={nomes} animalNome={animal.nome} />
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar genealogia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Pai (garanhão)">
              <SelectSimples
                value={paiId}
                onValueChange={setPaiId}
                options={[DESCONHECIDO, ...machos.map((a) => a.nome)]}
              />
            </Campo>
            <Campo label="Mãe (égua)">
              <SelectSimples
                value={maeId}
                onValueChange={setMaeId}
                options={[DESCONHECIDO, ...femeas.map((a) => a.nome)]}
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
    </Card>
  )
}

// --------------------------------------------------------------------- saúde

function AbaSaude({ animal }: { animal: Animal }) {
  const { data: registros, loading, reload } = useAsync(
    () => store.getSaudeRegistros(animal.id),
    [animal.id],
  )
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    tipo: TIPOS_SAUDE[0] as string,
    data_registro: hojeISO(),
    descricao: '',
    veterinario: '',
    proxima_data: '',
    custo: '',
    observacoes: '',
  })

  async function salvar() {
    const { isValid, errors } = validateSaude(form)
    setErros(errors)
    if (!isValid) return

    setSalvando(true)
    try {
      await store.createSaudeRegistro({
        animal_id: animal.id,
        tipo: form.tipo,
        data_registro: form.data_registro,
        descricao: form.descricao,
        veterinario: form.veterinario || null,
        proxima_data: form.proxima_data || null,
        custo: form.custo ? Number(form.custo) : null,
        observacoes: form.observacoes || null,
      })
      toast.success('Registro de saúde salvo.')
      setAberto(false)
      reload()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-4">
      <CabecalhoAba
        titulo="Registros de saúde e vacinação"
        acao={
          <Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="size-4" />
            Novo registro
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (registros ?? []).length === 0 ? (
        <Vazio>Nenhum registro de saúde.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Próxima</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registros ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.data_registro)}</TableCell>
                  <TableCell>
                    <span className="bg-secondary rounded-full px-2 py-0.5 text-xs">{r.tipo}</span>
                  </TableCell>
                  <TableCell>{r.descricao}</TableCell>
                  <TableCell>{r.veterinario || '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.proxima_data ? formatDate(r.proxima_data) : '--'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.custo != null
                      ? Number(r.custo).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo registro de saúde</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo" erro={erros.tipo}>
              <SelectSimples
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                options={TIPOS_SAUDE}
              />
            </Campo>
            <Campo label="Data" htmlFor="saude-data" erro={erros.data_registro}>
              <Input
                id="saude-data"
                type="date"
                value={form.data_registro}
                onChange={(e) => setForm((f) => ({ ...f, data_registro: e.target.value }))}
              />
            </Campo>
            <Campo label="Descrição / medicamento" htmlFor="saude-desc" className="sm:col-span-2">
              <Input
                id="saude-desc"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Campo>
            <Campo label="Veterinário / responsável" htmlFor="saude-vet">
              <Input
                id="saude-vet"
                value={form.veterinario}
                onChange={(e) => setForm((f) => ({ ...f, veterinario: e.target.value }))}
              />
            </Campo>
            <Campo label="Próxima aplicação" htmlFor="saude-prox">
              <Input
                id="saude-prox"
                type="date"
                value={form.proxima_data}
                onChange={(e) => setForm((f) => ({ ...f, proxima_data: e.target.value }))}
              />
            </Campo>
            <Campo label="Custo (R$)" htmlFor="saude-custo">
              <Input
                id="saude-custo"
                type="number"
                step="0.01"
                value={form.custo}
                onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
              />
            </Campo>
            <Campo label="Observações" htmlFor="saude-obs" className="sm:col-span-2">
              <Textarea
                id="saude-obs"
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
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------- reprodução

function AbaReproducao({ animal }: { animal: Animal }) {
  const { data: eventos, loading, reload } = useAsync(
    () => Promise.all([store.getReproducao(animal.id), store.getAnimaisMap()]),
    [animal.id],
  )
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    tipo: TIPOS_REPRODUCAO[0] as string,
    data_evento: hojeISO(),
    garanhao: '',
    metodo: '',
    data_prevista_parto: '',
    resultado: '',
    observacoes: '',
  })

  const lista = eventos?.[0] ?? []
  const mapa = eventos?.[1] ?? {}

  async function salvar() {
    const { isValid, errors } = validateReproducao(form)
    setErros(errors)
    if (!isValid) return

    setSalvando(true)
    try {
      await store.createReproducao({
        animal_id: animal.id,
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
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-4">
      <CabecalhoAba
        titulo="Histórico reprodutivo"
        acao={
          <Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="size-4" />
            Novo evento
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : lista.length === 0 ? (
        <Vazio>Nenhum evento reprodutivo.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Garanhão</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Previsão de parto</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Cria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(ev.data_evento)}</TableCell>
                  <TableCell>
                    <span className="bg-secondary rounded-full px-2 py-0.5 text-xs">{ev.tipo}</span>
                  </TableCell>
                  <TableCell>{ev.garanhao || '--'}</TableCell>
                  <TableCell>{ev.metodo || '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ev.data_prevista_parto ? formatDate(ev.data_prevista_parto) : '--'}
                  </TableCell>
                  <TableCell>{ev.resultado || '--'}</TableCell>
                  <TableCell>
                    {ev.cria_id ? (
                      <Link to={`/animal/${ev.cria_id}`} className="text-primary hover:underline">
                        {mapa[ev.cria_id]?.nome ?? 'Ver cria'}
                      </Link>
                    ) : (
                      '--'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo evento reprodutivo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo de evento" erro={erros.tipo}>
              <SelectSimples
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                options={TIPOS_REPRODUCAO}
              />
            </Campo>
            <Campo label="Data" htmlFor="rep-data" erro={erros.data_evento}>
              <Input
                id="rep-data"
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm((f) => ({ ...f, data_evento: e.target.value }))}
              />
            </Campo>
            <Campo label="Garanhão / parceiro" htmlFor="rep-garanhao">
              <Input
                id="rep-garanhao"
                value={form.garanhao}
                onChange={(e) => setForm((f) => ({ ...f, garanhao: e.target.value }))}
              />
            </Campo>
            <Campo label="Método" htmlFor="rep-metodo" hint="Ex: Monta natural, IA, TE">
              <Input
                id="rep-metodo"
                value={form.metodo}
                onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value }))}
              />
            </Campo>
            <Campo label="Previsão de parto" htmlFor="rep-parto">
              <Input
                id="rep-parto"
                type="date"
                value={form.data_prevista_parto}
                onChange={(e) => setForm((f) => ({ ...f, data_prevista_parto: e.target.value }))}
              />
            </Campo>
            <Campo label="Resultado" htmlFor="rep-resultado">
              <Input
                id="rep-resultado"
                value={form.resultado}
                onChange={(e) => setForm((f) => ({ ...f, resultado: e.target.value }))}
              />
            </Campo>
            <Campo label="Observações" htmlFor="rep-obs" className="sm:col-span-2">
              <Textarea
                id="rep-obs"
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
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ----------------------------------------------------------------- anotações

function AbaAnotacoes({ animal }: { animal: Animal }) {
  const { data: anotacoes, loading, reload } = useAsync(
    () => store.getAnotacoes(animal.id),
    [animal.id],
  )
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')

  async function salvar() {
    if (!titulo.trim() || !conteudo.trim()) {
      toast.error('Preencha título e conteúdo.')
      return
    }
    setSalvando(true)
    try {
      await store.createAnotacao({
        animal_id: animal.id,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        data_registro: hojeISO(),
      })
      toast.success('Anotação salva.')
      setAberto(false)
      setTitulo('')
      setConteudo('')
      reload()
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-4">
      <CabecalhoAba
        titulo="Anotações e diário"
        acao={
          <Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="size-4" />
            Nova anotação
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (anotacoes ?? []).length === 0 ? (
        <Vazio>Nenhuma anotação registrada.</Vazio>
      ) : (
        <ul className="space-y-3">
          {(anotacoes ?? []).map((a) => (
            <li key={a.id} className="border-primary bg-secondary/50 rounded-md border-l-2 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{a.titulo}</h3>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatDate(a.data_registro)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{a.conteudo}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova anotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Título" htmlFor="anot-titulo">
              <Input
                id="anot-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Ferrageamento"
              />
            </Campo>
            <Campo label="Conteúdo" htmlFor="anot-conteudo">
              <Textarea
                id="anot-conteudo"
                rows={4}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
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
    </Card>
  )
}

// -------------------------------------------------------------------- página

export default function Perfil() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: animal, loading, error } = useAsync(() => store.getAnimal(id), [id])
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  if (loading) {
    return (
      <>
        <Skeleton className="mb-4 h-36 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </>
    )
  }

  if (error || !animal) {
    return (
      <Card className="p-12 text-center">
        <h1 className="text-base font-semibold">Animal não encontrado</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ele pode ter sido removido do plantel.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link to="/catalogo" />}>
          Voltar ao plantel
        </Button>
      </Card>
    )
  }

  async function excluir() {
    setExcluindo(true)
    try {
      await store.deleteAnimal(id)
      toast.success('Animal removido do plantel.')
      navigate('/catalogo')
    } catch (e) {
      toast.error(`Erro ao remover: ${e instanceof Error ? e.message : 'desconhecido'}`)
      setExcluindo(false)
    }
  }

  const metricas: [typeof Scale, string, string][] = [
    [Scale, 'Peso', animal.peso ? `${animal.peso} kg` : '--'],
    [Ruler, 'Altura', animal.altura ? `${animal.altura} m` : '--'],
    [MapPin, 'Local', animal.baia_piquete || '--'],
    [Heart, 'Saúde', animal.status_saude || '--'],
  ]

  return (
    <>
      <PageHeader
        title="Perfil do animal"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link to={`/editar-animal/${animal.id}`} />}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
              <Trash2 className="text-destructive size-4" />
              Excluir
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start gap-5">
          <div className="bg-secondary border-border flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
            {animal.foto_url ? (
              <img src={animal.foto_url} alt={animal.nome} className="size-full object-cover" />
            ) : (
              <span className="font-brand text-primary text-3xl font-bold">
                {iniciais(animal.nome)}
              </span>
            )}
          </div>

          <div className="min-w-60 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{animal.nome}</h2>
              <StatusBadge status={animal.status_reprodutivo} />
            </div>

            <div className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <strong className="text-foreground font-medium">Pelagem:</strong>{' '}
                {animal.pelagem || '--'}
              </span>
              <span>
                <strong className="text-foreground font-medium">Marcha:</strong>{' '}
                {animal.tipo_marcha || '--'}
              </span>
              <span>
                <strong className="text-foreground font-medium">Idade:</strong>{' '}
                {calcularIdade(animal.data_nascimento)}
              </span>
              {animal.registro_abccmm && (
                <span>
                  <strong className="text-foreground font-medium">ABCCMM:</strong>{' '}
                  {animal.registro_abccmm}
                </span>
              )}
            </div>

            <div className="bg-secondary/60 border-border flex flex-wrap gap-x-6 gap-y-2 rounded-md border p-3">
              {metricas.map(([Icone, rotulo, valor]) => (
                <div key={rotulo} className="flex items-center gap-1.5 text-sm">
                  <Icone className="text-muted-foreground size-4" />
                  <span className="text-muted-foreground">{rotulo}:</span>
                  <strong className="font-medium">{valor}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="informacoes">
        <TabsList className="mb-4">
          <TabsTrigger value="informacoes">Informações</TabsTrigger>
          <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
          <TabsTrigger value="saude">Saúde</TabsTrigger>
          <TabsTrigger value="reproducao">Reprodução</TabsTrigger>
          <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="informacoes">
          <AbaInformacoes animal={animal} />
        </TabsContent>
        <TabsContent value="genealogia">
          <AbaGenealogia animal={animal} />
        </TabsContent>
        <TabsContent value="saude">
          <AbaSaude animal={animal} />
        </TabsContent>
        <TabsContent value="reproducao">
          <AbaReproducao animal={animal} />
        </TabsContent>
        <TabsContent value="anotacoes">
          <AbaAnotacoes animal={animal} />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {animal.nome} do plantel?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            O animal deixa de aparecer nas listagens, mas o histórico continua no banco de dados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={excluindo}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
