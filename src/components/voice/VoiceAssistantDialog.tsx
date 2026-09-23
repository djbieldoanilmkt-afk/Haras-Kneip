import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, SkipForward, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { STEPS, comandoGlobal } from './voiceWizard'

type Reconhecimento = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function criarReconhecimento(): Reconhecimento | null {
  const janela = window as unknown as {
    SpeechRecognition?: new () => Reconhecimento
    webkitSpeechRecognition?: new () => Reconhecimento
  }
  const Construtor = janela.SpeechRecognition ?? janela.webkitSpeechRecognition
  if (!Construtor) return null

  const r = new Construtor()
  r.lang = 'pt-BR'
  r.continuous = false
  r.interimResults = false
  return r
}

export function VoiceAssistantDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (dados: Record<string, string>) => void
}) {
  const [indice, setIndice] = useState(0)
  const [dados, setDados] = useState<Record<string, string>>({})
  const [ouvindo, setOuvindo] = useState(false)
  const [falando, setFalando] = useState(false)
  const [status, setStatus] = useState('Iniciando...')
  const [suportado, setSuportado] = useState(true)

  const reconhecimento = useRef<Reconhecimento | null>(null)
  const passo = STEPS[indice]

  const falar = useCallback((texto: string, aoTerminar?: () => void) => {
    if (!window.speechSynthesis) {
      aoTerminar?.()
      return
    }
    window.speechSynthesis.cancel()

    const fala = new SpeechSynthesisUtterance(texto)
    fala.lang = 'pt-BR'
    fala.onend = () => {
      setFalando(false)
      aoTerminar?.()
    }
    setFalando(true)
    window.speechSynthesis.speak(fala)
  }, [])

  const ouvir = useCallback(() => {
    const r = reconhecimento.current
    if (!r) return
    try {
      r.start()
      setOuvindo(true)
      setStatus('Ouvindo... pode falar.')
    } catch {
      // start() lanca se ja estiver ativo; nao ha o que fazer.
    }
  }, [])

  const responder = useCallback(
    (texto: string) => {
      const comando = comandoGlobal(texto)
      if (comando === 'cancelar') {
        onOpenChange(false)
        return
      }
      if (comando === 'voltar') {
        setIndice((i) => Math.max(0, i - 1))
        return
      }

      const atual = STEPS[indice]
      const valor = atual.parse(texto)
      setDados((d) => ({ ...d, [atual.key]: valor }))
      setStatus(`Entendido: "${valor || 'pulado'}"`)
      setIndice((i) => i + 1)
    },
    [indice, onOpenChange],
  )

  // Prepara o reconhecimento de voz quando o diálogo abre.
  useEffect(() => {
    if (!open) return

    const r = criarReconhecimento()
    if (!r) {
      setSuportado(false)
      return
    }

    r.onresult = (e) => responder(e.results[0][0].transcript)
    r.onerror = () => {
      setOuvindo(false)
      setStatus('Não entendi bem. Toque no microfone para tentar de novo.')
    }
    r.onend = () => setOuvindo(false)

    reconhecimento.current = r
    return () => {
      try {
        r.stop()
      } catch {
        /* ja parado */
      }
      window.speechSynthesis?.cancel()
    }
  }, [open, responder])

  // Reinicia o roteiro a cada abertura.
  useEffect(() => {
    if (open) {
      setIndice(0)
      setDados({})
      setStatus('Iniciando...')
    }
  }, [open])

  // Faz a pergunta do passo atual e escuta em seguida.
  useEffect(() => {
    if (!open || !suportado) return

    if (indice >= STEPS.length) {
      falar(
        'Pronto! Preenchi as informações por voz. Agora você pode adicionar uma foto ou salvar o cadastro.',
        () => {
          onComplete({ ...dados, raca: 'Mangalarga Marchador' })
          onOpenChange(false)
        },
      )
      return
    }

    falar(STEPS[indice].question, () => {
      window.setTimeout(ouvir, 300)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, open, suportado])

  function pular() {
    const atual = STEPS[indice]
    setDados((d) => ({ ...d, [atual.key]: '' }))
    setIndice((i) => i + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrevista por voz</DialogTitle>
        </DialogHeader>

        {!suportado ? (
          <div className="py-6 text-center">
            <MicOff className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm font-medium">
              Este navegador não tem reconhecimento de voz nativo.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Use o Google Chrome ou o Microsoft Edge, ou preencha o formulário digitando.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div
              className={cn(
                'bg-secondary mx-auto flex size-14 items-center justify-center rounded-full transition-colors',
                ouvindo && 'bg-destructive/15 text-destructive',
                falando && 'bg-accent text-accent-foreground',
              )}
            >
              {falando ? <Volume2 className="size-6" /> : <Mic className="size-6" />}
            </div>

            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Passo {Math.min(indice + 1, STEPS.length)} de {STEPS.length}
                {passo ? ` · ${passo.label}` : ''}
              </p>
              <p className="mt-1 min-h-10 text-sm font-medium">{passo?.question ?? 'Concluindo...'}</p>
              {passo && <p className="text-muted-foreground mt-1 text-xs">{passo.example}</p>}
            </div>

            <p className="text-muted-foreground text-xs italic">{status}</p>

            <div className="bg-secondary h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${(Math.min(indice, STEPS.length) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {suportado && (
            <>
              <Button variant="outline" onClick={pular} disabled={indice >= STEPS.length}>
                <SkipForward className="size-4" />
                Pular
              </Button>
              <Button onClick={ouvir} disabled={ouvindo || falando || indice >= STEPS.length}>
                <Mic className="size-4" />
                {ouvindo ? 'Ouvindo...' : 'Falar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
