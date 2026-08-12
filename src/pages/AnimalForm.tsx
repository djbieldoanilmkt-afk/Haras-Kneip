import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Mic } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Campo, SelectSimples } from '@/components/form/Campo'
import { VoiceAssistantDialog } from '@/components/voice/VoiceAssistantDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { PELAGENS, STATUS_REPRODUTIVO, TIPOS_MARCHA } from '@/lib/status'
import { validateAnimal } from '@/lib/validators'
import type { Animal, Sexo } from '@/lib/database.types'

type Formulario = {
  nome: string
  apelido: string
  registro: string
  registro_abccmm: string
  pelagem: string
  tipo_marcha: string
  sexo: Sexo
  data_nascimento: string
  peso: string
  altura: string
  baia_piquete: string
  status_reprodutivo: string
  status_saude: string
  premiacao: string
  foto_url: string
  observacoes: string
}

const VAZIO: Formulario = {
  nome: '',
  apelido: '',
  registro: '',
  registro_abccmm: '',
  pelagem: 'Alazã',
  tipo_marcha: 'Marcha Batida',
  sexo: 'Fêmea',
  data_nascimento: '',
  peso: '',
  altura: '',
  baia_piquete: '',
  status_reprodutivo: 'Vazia',
  status_saude: 'Saudável',
  premiacao: '',
  foto_url: '',
  observacoes: '',
}

const SEXOS = ['Fêmea', 'Macho'] as const

function Secao({ titulo }: { titulo: string }) {
  return (
    <h2 className="text-muted-foreground col-span-full mt-2 border-b pb-1.5 text-xs font-semibold tracking-wider uppercase">
      {titulo}
    </h2>
  )
}

export default function AnimalForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const { data: animal, loading } = useAsync(
    () => (id ? store.getAnimal(id) : Promise.resolve(null)),
    [id],
  )

  const [form, setForm] = useState<Formulario>(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [vozAberta, setVozAberta] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!animal) return
    setForm({
      nome: animal.nome ?? '',
      apelido: animal.apelido ?? '',
      registro: animal.registro ?? '',
      registro_abccmm: animal.registro_abccmm ?? '',
      pelagem: animal.pelagem ?? 'Alazã',
      tipo_marcha: animal.tipo_marcha ?? 'Marcha Batida',
      sexo: animal.sexo ?? 'Fêmea',
      data_nascimento: animal.data_nascimento?.slice(0, 10) ?? '',
      peso: animal.peso != null ? String(animal.peso) : '',
      altura: animal.altura != null ? String(animal.altura) : '',
      baia_piquete: animal.baia_piquete ?? '',
      status_reprodutivo: animal.status_reprodutivo ?? 'Vazia',
      status_saude: animal.status_saude ?? 'Saudável',
      premiacao: animal.premiacao ?? '',
      foto_url: animal.foto_url ?? '',
      observacoes: animal.observacoes ?? '',
    })
  }, [animal])

  const definir = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  function anexarFoto(arquivo: File) {
    const leitor = new FileReader()
    leitor.onload = (e) => {
      definir('foto_url', String(e.target?.result ?? ''))
      toast.success('Foto anexada.')
    }
    leitor.readAsDataURL(arquivo)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    const dados: Partial<Animal> = {
      nome: form.nome.trim(),
      apelido: form.apelido || null,
      registro: form.registro || null,
      registro_abccmm: form.registro_abccmm || null,
      raca: 'Mangalarga Marchador',
      pelagem: form.pelagem,
      tipo_marcha: form.tipo_marcha,
      sexo: form.sexo,
      data_nascimento: form.data_nascimento || null,
      peso: form.peso ? Number(form.peso) : null,
      altura: form.altura ? Number(form.altura) : null,
      baia_piquete: form.baia_piquete || null,
      status_reprodutivo: form.status_reprodutivo,
      status_saude: form.status_saude || null,
      premiacao: form.premiacao || null,
      foto_url: form.foto_url || null,
      observacoes: form.observacoes || null,
    }

    const { isValid, errors } = validateAnimal({ nome: dados.nome, raca: dados.raca })
    setErros(errors)
    if (!isValid) {
      toast.error('Confira os campos obrigatórios.')
      return
    }

    setSalvando(true)
    try {
      const salvo = id ? await store.updateAnimal(id, dados) : await store.createAnimal(dados)
      toast.success(editando ? 'Animal atualizado.' : 'Animal cadastrado.')
      navigate(`/animal/${salvo.id}`)
    } catch (err) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  if (editando && loading) {
    return <Skeleton className="h-[600px] rounded-lg" />
  }

  return (
    <>
      <PageHeader title={editando ? 'Editar animal' : 'Novo animal'} />

      <Card className="mx-auto max-w-3xl p-5">
        <div className="bg-accent border-border mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-accent-foreground text-sm font-semibold">Assistente de voz</p>
            <p className="text-muted-foreground text-xs">
              Prefere falar em vez de digitar? O assistente pergunta e preenche para você.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setVozAberta(true)}>
            <Mic className="size-4" />
            Iniciar por voz
          </Button>
        </div>

        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          <Secao titulo="Identificação" />

          <Campo label="Nome completo *" htmlFor="nome" erro={erros.nome}>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => definir('nome', e.target.value)}
              placeholder="Ex: Estrela D'Alva do Kneip"
            />
          </Campo>
          <Campo label="Apelido" htmlFor="apelido">
            <Input
              id="apelido"
              value={form.apelido}
              onChange={(e) => definir('apelido', e.target.value)}
              placeholder="Ex: Estrelinha"
            />
          </Campo>
          <Campo label="Nº registro ABCCMM" htmlFor="abccmm">
            <Input
              id="abccmm"
              value={form.registro_abccmm}
              onChange={(e) => definir('registro_abccmm', e.target.value)}
              placeholder="Ex: 001.234-A"
            />
          </Campo>
          <Campo label="Registro interno" htmlFor="registro">
            <Input
              id="registro"
              value={form.registro}
              onChange={(e) => definir('registro', e.target.value)}
              placeholder="Ex: MM-2024-001"
            />
          </Campo>

          <Secao titulo="Características" />

          <Campo label="Pelagem">
            <SelectSimples
              value={form.pelagem}
              onValueChange={(v) => definir('pelagem', v)}
              options={PELAGENS}
            />
          </Campo>
          <Campo label="Tipo de marcha">
            <SelectSimples
              value={form.tipo_marcha}
              onValueChange={(v) => definir('tipo_marcha', v)}
              options={TIPOS_MARCHA}
            />
          </Campo>
          <Campo label="Sexo">
            <SelectSimples
              value={form.sexo}
              onValueChange={(v) => definir('sexo', v as Sexo)}
              options={SEXOS}
            />
          </Campo>

          <Secao titulo="Dados físicos" />

          <Campo label="Data de nascimento" htmlFor="nascimento">
            <Input
              id="nascimento"
              type="date"
              value={form.data_nascimento}
              onChange={(e) => definir('data_nascimento', e.target.value)}
            />
          </Campo>
          <Campo label="Peso (kg)" htmlFor="peso">
            <Input
              id="peso"
              type="number"
              step="0.1"
              value={form.peso}
              onChange={(e) => definir('peso', e.target.value)}
              placeholder="Ex: 450"
            />
          </Campo>
          <Campo label="Altura (m)" htmlFor="altura">
            <Input
              id="altura"
              type="number"
              step="0.01"
              value={form.altura}
              onChange={(e) => definir('altura', e.target.value)}
              placeholder="Ex: 1.52"
            />
          </Campo>

          <Secao titulo="Localização e status" />

          <Campo label="Baia / piquete" htmlFor="baia">
            <Input
              id="baia"
              value={form.baia_piquete}
              onChange={(e) => definir('baia_piquete', e.target.value)}
              placeholder="Ex: Piquete 3"
            />
          </Campo>
          <Campo label="Status reprodutivo">
            <SelectSimples
              value={form.status_reprodutivo}
              onValueChange={(v) => definir('status_reprodutivo', v)}
              options={STATUS_REPRODUTIVO}
            />
          </Campo>
          <Campo label="Status de saúde" htmlFor="saude">
            <Input
              id="saude"
              value={form.status_saude}
              onChange={(e) => definir('status_saude', e.target.value)}
            />
          </Campo>
          <Campo label="Premiações" htmlFor="premiacao">
            <Input
              id="premiacao"
              value={form.premiacao}
              onChange={(e) => definir('premiacao', e.target.value)}
              placeholder="Ex: Campeã Nacional 2023"
            />
          </Campo>

          <Secao titulo="Foto" />

          <Campo label="Foto do animal" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={inputFoto}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) anexarFoto(arquivo)
                }}
              />
              <Button type="button" variant="outline" onClick={() => inputFoto.current?.click()}>
                <Camera className="size-4" />
                Tirar foto ou escolher arquivo
              </Button>

              <div className="bg-secondary border-border size-16 shrink-0 overflow-hidden rounded-md border">
                {form.foto_url ? (
                  <img src={form.foto_url} alt="Prévia" className="size-full object-cover" />
                ) : (
                  <span className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                    Sem foto
                  </span>
                )}
              </div>
            </div>
          </Campo>

          <Campo label="Observações" htmlFor="observacoes" className="sm:col-span-2">
            <Textarea
              id="observacoes"
              rows={3}
              value={form.observacoes}
              onChange={(e) => definir('observacoes', e.target.value)}
            />
          </Campo>

          <div className="col-span-full mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar animal'}
            </Button>
          </div>
        </form>
      </Card>

      <VoiceAssistantDialog
        open={vozAberta}
        onOpenChange={setVozAberta}
        onComplete={(dados) => {
          setForm((f) => ({
            ...f,
            ...Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '')),
          }))
          toast.success('Formulário preenchido por voz. Revise antes de salvar.')
        }}
      />
    </>
  )
}
