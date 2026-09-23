/**
 * Uma avaliação morfológica, pelo site.
 *
 * A mesma avaliação que o WhatsApp conduz: mesmos estados, mesma fila, mesmo
 * laudo. A diferença é o formato da conversa — o agente pede uma peça de cada
 * vez porque no celular não cabe mais que isso; aqui as nove aparecem juntas e
 * o dono envia na ordem que quiser.
 *
 * O ROTEIRO NÃO MORA AQUI
 *
 * Quais são as nove peças, como cada uma se chama em português e quando o
 * material está completo vem tudo de `morfologia_app_painel`. Se esta tela
 * montasse a lista, o roteiro passaria a existir em dois lugares e mudaria
 * num só.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft, Download, Film, Loader2, Check, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import { validarMidia } from '../../supabase/functions/_compartilhado/midia'
import type { PecaMaterial } from '@/lib/database.types'

/* Os recados do módulo compartilhado são escritos para o WhatsApp, onde
   *asteriscos* viram negrito. Na tela eles apareceriam como asteriscos. */
function semMarcacao(texto: string): string {
  return texto.replace(/\*/g, '')
}

const ROTULO_ESTADO: Record<string, string> = {
  INICIADA: 'começando',
  ESCOLHER_ANIMAL: 'escolhendo o animal',
  CONFIRMAR_ANIMAL: 'confirmando o animal',
  COLETAR_DADOS: 'faltam dados do animal',
  VALIDANDO_MIDIA: 'conferindo o material',
  PRONTA_PARA_PROCESSAR: 'na fila',
  PROCESSANDO: 'analisando as imagens',
  GERANDO_RELATORIO: 'montando o laudo',
  CONCLUIDA: 'concluída',
  CANCELADA: 'cancelada',
  FALHOU: 'falhou',
}

function rotuloEstado(estado: string): string {
  if (estado.startsWith('PEDIR_')) return 'recebendo material'
  return ROTULO_ESTADO[estado] ?? estado.toLowerCase()
}

const EM_ANDAMENTO = new Set(['PRONTA_PARA_PROCESSAR', 'PROCESSANDO', 'GERANDO_RELATORIO'])

/** Largura e altura de uma imagem, ou nulo quando o navegador não decodifica. */
async function medir(arquivo: File): Promise<{ largura: number; altura: number } | null> {
  if (!arquivo.type.startsWith('image/')) return null
  try {
    const bitmap = await createImageBitmap(arquivo)
    const dimensao = { largura: bitmap.width, altura: bitmap.height }
    bitmap.close()
    return dimensao
  } catch {
    /* HEIC de iPhone cai aqui. Dimensão nula é "não sei", não "ruim" — a
       validação compartilhada já trata esse caso. */
    return null
  }
}

function Peca({
  peca,
  enviando,
  onArquivo,
}: {
  peca: PecaMaterial
  enviando: boolean
  onArquivo: (arquivo: File) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const Icone = peca.tipo === 'video' ? Film : Camera
  const recusada = peca.validacao === 'RECUSADA'
  const chegou = peca.enviada && !recusada

  return (
    <Card
      className={cn(
        'gap-0 p-4 transition-colors',
        chegou && 'ring-primary/30',
        recusada && 'ring-destructive/40',
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <Icone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-medium">
            {peca.rotulo.charAt(0).toUpperCase() + peca.rotulo.slice(1)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {chegou
              ? peca.validacao === 'REPETIR_RECOMENDADO'
                ? 'recebida — dá para usar'
                : 'recebida'
              : recusada
                ? 'não serve'
                : 'faltando'}
          </p>
        </div>
        {chegou && <Check className="text-primary mt-0.5 size-4 shrink-0" />}
        {recusada && <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" />}
      </div>

      {peca.observacao && (
        <p className="text-muted-foreground mb-3 text-xs">{semMarcacao(peca.observacao)}</p>
      )}

      {peca.tipo === 'video' && (peca.quadros ?? 0) > 0 && (
        <p className="text-muted-foreground mb-3 text-xs">{peca.quadros} quadros aproveitados</p>
      )}

      <input
        ref={entrada}
        type="file"
        accept={peca.tipo === 'video' ? 'video/*' : 'image/*'}
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          /* Limpa o valor para que reenviar o MESMO arquivo dispare de novo:
             sem isto, corrigir a foto e reenviá-la com o mesmo nome não faria
             nada, e o dono não teria como saber por quê. */
          e.target.value = ''
          if (arquivo) onArquivo(arquivo)
        }}
      />
      <Button
        variant={chegou ? 'outline' : 'default'}
        size="sm"
        className="w-full"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
      >
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : chegou || recusada ? (
          'Trocar'
        ) : (
          'Enviar'
        )}
      </Button>
    </Card>
  )
}

export default function MorfologiaAvaliacao() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: painel, loading, error, reload } = useAsync(
    () => store.getPainelAvaliacao(id),
    [id],
  )
  const [enviando, setEnviando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  /*
    Enquanto a fila trabalha, a tela se atualiza sozinha.

    O processamento leva minutos e acontece em cron do outro lado. Sem isto, o
    dono ficaria olhando "na fila" e recarregando a página na mão para saber se
    o laudo saiu.
  */
  const processando = !!painel && EM_ANDAMENTO.has(painel.estado)
  useEffect(() => {
    if (!processando) return
    const t = setInterval(reload, 15000)
    return () => clearInterval(t)
  }, [processando, reload])

  const enviar = useCallback(
    async (peca: PecaMaterial, arquivo: File) => {
      if (!painel) return
      setEnviando(peca.papel)
      try {
        const dimensao = await medir(arquivo)
        const veredito = validarMidia({
          papel: peca.papel,
          mime: arquivo.type,
          bytes: arquivo.size,
          dimensao,
        })

        /* Recusada não sobe: não adianta gastar rede com um arquivo que a
           análise não vai usar, e o recado já diz o que fazer. */
        if (veredito.validacao === 'RECUSADA') {
          toast.error(semMarcacao(veredito.recado) || 'Este arquivo não serve para esta peça.')
          return
        }

        const harasId = await store.meuHarasId()
        const r = await store.enviarMidiaAvaliacao({
          avaliacaoId: painel.avaliacao_id,
          harasId,
          papel: peca.papel,
          arquivo,
          validacao: veredito.validacao,
          codigos: veredito.codigos,
          observacao: veredito.recado ? semMarcacao(veredito.recado) : null,
          largura: dimensao?.largura ?? null,
          altura: dimensao?.altura ?? null,
        })

        if (r.completo) toast.success('Material completo. A análise já entrou na fila.')
        else if (veredito.validacao === 'REPETIR_RECOMENDADO') {
          toast.warning(semMarcacao(veredito.recado))
        } else toast.success(`Recebi a ${peca.rotulo}.`)

        reload()
      } catch (e) {
        toast.error(`Não consegui enviar: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
      } finally {
        setEnviando(null)
      }
    },
    [painel, reload],
  )

  async function baixarLaudo() {
    if (!painel?.laudo) return
    try {
      window.open(await store.linkMorfologia(painel.laudo.caminho), '_blank')
    } catch (e) {
      toast.error(`Não consegui abrir o laudo: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  async function cancelar() {
    try {
      await store.cancelarAvaliacao(id)
      toast.success('Avaliação cancelada.')
      navigate('/morfologia')
    } catch (e) {
      toast.error(`Não consegui cancelar: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  if (loading) {
    return (
      <>
        <Skeleton className="mb-4 h-10 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </>
    )
  }

  if (error || !painel) {
    return (
      <Card className="p-12 text-center">
        <h1 className="text-base font-semibold">Avaliação não encontrada</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {error instanceof Error ? error.message : 'Ela pode ter sido cancelada.'}
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link to="/morfologia" />}>
          Voltar
        </Button>
      </Card>
    )
  }

  const enviadas = painel.material.filter((p) => p.enviada && p.validacao !== 'RECUSADA').length
  const coletando = !painel.completo && painel.estado !== 'CANCELADA'
  const falhou = painel.tarefas.find((t) => t.situacao === 'falhou')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/morfologia"
          className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" />
          Avaliações
        </Link>
        {painel.estado !== 'CONCLUIDA' && painel.estado !== 'CANCELADA' && (
          <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
            Cancelar avaliação
          </Button>
        )}
      </div>

      <Card className="mb-4 gap-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg leading-tight font-bold">
              {painel.animal?.nome ?? 'Animal sem nome'}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Avaliação morfológica · {rotuloEstado(painel.estado)}
              {painel.origem === 'whatsapp' && ' · começou pelo WhatsApp'}
            </p>
          </div>

          {painel.estado === 'CONCLUIDA' && painel.nota_geral != null && (
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  Nota geral
                </div>
                <div className="text-2xl font-bold">
                  {painel.nota_geral.toFixed(1).replace('.', ',')}
                </div>
              </div>
              {painel.laudo && (
                <Button size="sm" onClick={baixarLaudo}>
                  <Download className="size-4" />
                  Laudo
                </Button>
              )}
            </div>
          )}
        </div>

        {painel.potencial && (
          <p className="text-muted-foreground mt-3 text-sm">{painel.potencial}</p>
        )}
      </Card>

      {falhou && (
        <Card className="ring-destructive/40 mb-4 p-4">
          <p className="text-sm font-medium">O processamento parou.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {falhou.erro ?? 'Sem detalhe registrado.'} A fila tenta de novo sozinha.
          </p>
        </Card>
      )}

      {coletando ? (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Material — {enviadas} de {painel.material.length}
            </h2>
            <p className="text-muted-foreground text-xs">
              Assim que a última peça chegar, a análise começa sozinha.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {painel.material.map((peca) => (
              <Peca
                key={peca.papel}
                peca={peca}
                enviando={enviando === peca.papel}
                onArquivo={(arquivo) => enviar(peca, arquivo)}
              />
            ))}
          </div>
        </>
      ) : (
        <Card className="p-8 text-center">
          {processando ? (
            <>
              <Loader2 className="text-muted-foreground mx-auto mb-3 size-6 animate-spin" />
              <p className="text-sm font-medium">{rotuloEstado(painel.estado)}</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                As nove peças estão no lugar. Isso leva alguns minutos — pode fechar a página, a
                análise continua e o laudo aparece aqui quando ficar pronto.
              </p>
            </>
          ) : painel.estado === 'CANCELADA' ? (
            <p className="text-muted-foreground text-sm">Esta avaliação foi cancelada.</p>
          ) : (
            <>
              <p className="text-sm font-medium">Laudo pronto</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Material aproveitado: {painel.qualidade_material ?? 0}%
                {painel.confianca != null &&
                  ` · confiança ${painel.confianca.toFixed(1).replace('.', ',')}`}
              </p>
              {painel.laudo && (
                <Button className="mt-4" onClick={baixarLaudo}>
                  <Download className="size-4" />
                  Abrir o laudo em PDF
                </Button>
              )}
            </>
          )}
        </Card>
      )}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar esta avaliação?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            O material já enviado continua guardado, mas a análise não acontece e o laudo não é
            gerado. Para retomar, será preciso abrir uma avaliação nova.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={cancelar}>
              Cancelar avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
