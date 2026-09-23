/**
 * As avaliações morfológicas do haras.
 *
 * Mostra as que começaram pelo site e as que começaram pelo WhatsApp na mesma
 * lista, porque são a mesma coisa: quem manda as fotos pelo celular no curral
 * acompanha o laudo aqui, e quem começa aqui pode terminar pelo telefone.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, MessageCircle, Monitor, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'
import type { AvaliacaoResumo } from '@/lib/database.types'

const ROTULO_ESTADO: Record<string, string> = {
  PRONTA_PARA_PROCESSAR: 'na fila',
  PROCESSANDO: 'analisando',
  GERANDO_RELATORIO: 'montando o laudo',
  CONCLUIDA: 'concluída',
  CANCELADA: 'cancelada',
  FALHOU: 'falhou',
}

function rotuloEstado(estado: string): string {
  if (estado.startsWith('PEDIR_') || estado === 'INICIADA') return 'recebendo material'
  return ROTULO_ESTADO[estado] ?? estado.toLowerCase()
}

function corEstado(estado: string): string {
  if (estado === 'CONCLUIDA') return 'bg-primary/10 text-primary'
  if (estado === 'FALHOU' || estado === 'CANCELADA') return 'bg-destructive/10 text-destructive'
  return 'bg-secondary text-muted-foreground'
}

function Linha({ a, onAbrirLaudo }: { a: AvaliacaoResumo; onAbrirLaudo: () => void }) {
  const Origem = a.origem === 'whatsapp' ? MessageCircle : Monitor

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <div className="min-w-48 flex-1">
          <Link
            to={`/morfologia/${a.avaliacao_id}`}
            className="hover:text-primary text-sm font-semibold transition-colors"
          >
            {a.animal ?? 'Animal sem nome'}
          </Link>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <Origem className="size-3" />
            {formatDate(a.iniciada_em)}
            {a.finalidade && ` · ${a.finalidade}`}
          </p>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
            corEstado(a.estado),
          )}
        >
          {rotuloEstado(a.estado)}
        </span>

        {/* Enquanto coleta, o que interessa é quanto falta. Depois, a nota. */}
        <div className="w-24 text-right">
          {a.nota_geral != null ? (
            <>
              <div className="text-muted-foreground text-[10px] tracking-wide uppercase">nota</div>
              <div className="text-base font-bold">
                {a.nota_geral.toFixed(1).replace('.', ',')}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-xs">{a.pecas} de 9 peças</div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {a.laudo && (
            <Button variant="outline" size="sm" onClick={onAbrirLaudo}>
              <Download className="size-4" />
              Laudo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to={`/morfologia/${a.avaliacao_id}`} />}
          >
            Abrir
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default function Morfologia() {
  const navigate = useNavigate()
  const { data: avaliacoes, loading, error, reload } = useAsync(() => store.getAvaliacoes(), [])
  const { data: animais } = useAsync(() => store.getAnimais(), [])
  const [escolhendo, setEscolhendo] = useState(false)
  const [busca, setBusca] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  const candidatos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = animais ?? []
    if (!termo) return lista.slice(0, 40)
    return lista.filter((a) => a.nome.toLowerCase().includes(termo)).slice(0, 40)
  }, [animais, busca])

  async function abrir(animalId: string) {
    setAbrindo(true)
    try {
      const r = await store.abrirAvaliacao(animalId)
      if (r.retomada) toast.info(`Retomando a avaliação de ${r.animal} que já estava aberta.`)
      navigate(`/morfologia/${r.avaliacao_id}`)
    } catch (e) {
      toast.error(`Não consegui abrir: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
      setAbrindo(false)
    }
  }

  async function abrirLaudo(caminho: string) {
    try {
      window.open(await store.linkMorfologia(caminho), '_blank')
    } catch (e) {
      toast.error(`Não consegui abrir o laudo: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  return (
    <>
      <PageHeader
        title="Avaliação morfológica"
        description="Fotos e vídeos do animal viram um laudo de conformação, região por região."
        actions={
          <Button size="sm" onClick={() => setEscolhendo(true)}>
            <Plus className="size-4" />
            Nova avaliação
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : error ? (
        /*
          Lista vazia e lista que não carregou não são a mesma tela.

          O recurso pode não estar liberado para este haras, e aí o banco
          recusa. Mostrar "nenhuma avaliação ainda" mandaria a pessoa clicar em
          "começar" para receber o mesmo erro, sem nunca saber o motivo.
        */
        <Card className="p-12 text-center">
          <h2 className="text-base font-semibold">Não consegui carregar as avaliações</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {error instanceof Error ? error.message : 'Erro desconhecido.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={reload}>
            Tentar de novo
          </Button>
        </Card>
      ) : (avaliacoes ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="text-base font-semibold">Nenhuma avaliação ainda</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            São seis fotos e três vídeos do animal. Dá para enviar por aqui ou pelo WhatsApp — é a
            mesma avaliação, e o laudo sai no mesmo lugar.
          </p>
          <Button className="mt-4" onClick={() => setEscolhendo(true)}>
            <Plus className="size-4" />
            Começar uma avaliação
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(avaliacoes ?? []).map((a) => (
            <Linha
              key={a.avaliacao_id}
              a={a}
              onAbrirLaudo={() => a.laudo && abrirLaudo(a.laudo)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={escolhendo}
        onOpenChange={(aberto) => {
          setEscolhendo(aberto)
          if (!aberto) {
            setBusca('')
            reload()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qual animal?</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar no plantel..."
              className="pl-9"
            />
          </div>

          <div className="-mx-1 max-h-72 overflow-y-auto px-1">
            {candidatos.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nenhum animal com esse nome.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {candidatos.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={abrindo}
                      onClick={() => abrir(a.id)}
                      className="hover:bg-secondary/60 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors disabled:opacity-50"
                    >
                      <span className="truncate text-sm font-medium">{a.nome}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {a.sexo === 'Fêmea' ? 'Égua' : 'Garanhão'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEscolhendo(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
