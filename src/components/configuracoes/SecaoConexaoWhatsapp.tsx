import { useEffect, useRef, useState } from 'react'
import { QrCode, Smartphone, Unplug } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTenant } from '@/hooks/tenant'
import { store, type EstadoWhatsapp } from '@/lib/store'
import { formatarTelefone } from '@/lib/telefone'
import { cn } from '@/lib/utils'

/** O QR da Evolution expira em cerca de um minuto; o estado é conferido nesse ritmo. */
const INTERVALO_MS = 4000

const ROTULO: Record<string, string> = {
  open: 'Conectado',
  connecting: 'Aguardando leitura do QR',
  close: 'Desconectado',
}

/**
 * Conexão do número do assistente.
 *
 * A chave da Evolution nunca chega aqui: a tela fala com uma Edge Function,
 * que é quem guarda a credencial e conversa com o servidor. No bundle do
 * front qualquer chave seria pública.
 */
export function SecaoConexaoWhatsapp() {
  const { papel } = useTenant()
  const [estado, setEstado] = useState<EstadoWhatsapp | null>(null)
  const [qr, setQr] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [conectando, setConectando] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const conectado = estado?.estado === 'open'

  async function consultar() {
    try {
      setEstado(await store.conexaoWhatsapp('estado'))
    } catch (e) {
      setEstado({ estado: 'erro', erro: e instanceof Error ? e.message : 'falha' })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (papel !== 'dono') {
      setCarregando(false)
      return
    }
    void consultar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel])

  // Enquanto o QR está na tela, o estado é consultado até a sessão abrir.
  useEffect(() => {
    if (!qr) return

    timer.current = setInterval(async () => {
      const atual = await store.conexaoWhatsapp('estado').catch(() => null)
      if (atual?.estado === 'open') {
        setEstado(atual)
        setQr('')
        toast.success('WhatsApp conectado.')
      }
    }, INTERVALO_MS)

    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [qr])

  async function conectar() {
    setConectando(true)
    try {
      const r = await store.conexaoWhatsapp('conectar')
      if (!r.qr) {
        toast.error('A Evolution não devolveu o QR. Confira se o servidor está no ar.')
        return
      }
      setQr(r.qr)
      setEstado(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível conectar.')
    } finally {
      setConectando(false)
    }
  }

  async function desconectar() {
    try {
      setEstado(await store.conexaoWhatsapp('desconectar'))
      setQr('')
      toast.success('WhatsApp desconectado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível desconectar.')
    }
  }

  if (papel !== 'dono') return null

  return (
    <Card className="mb-4 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4" />
          Número do assistente
        </h2>
        {!carregando && (
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              conectado ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                conectado ? 'bg-primary' : estado?.estado === 'connecting' ? 'bg-status-prenha' : 'bg-status-vazia',
              )}
            />
            {ROTULO[estado?.estado ?? ''] ?? 'Indisponível'}
          </span>
        )}
      </div>

      <p className="text-muted-foreground mb-4 text-sm">
        Este é o número que a equipe vai acionar no WhatsApp. Conecte um chip dedicado ao
        assistente — não use o seu pessoal nem o comercial do haras.
      </p>

      {carregando ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : estado?.estado === 'erro' ? (
        <p className="text-destructive text-sm">{estado.erro}</p>
      ) : conectado ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{formatarTelefone(estado?.numero ?? null) || 'Número conectado'}</p>
            <p className="text-muted-foreground text-xs">
              É para este número que a equipe manda o PIN de confirmação.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={desconectar}>
            <Unplug className="size-4" />
            Desconectar
          </Button>
        </div>
      ) : qr ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {/* A Evolution devolve o QR já como data URI. */}
          <img
            src={qr}
            alt="QR Code para conectar o WhatsApp"
            className="border-border size-56 rounded-lg border bg-white p-2"
          />
          <div className="text-sm">
            <p className="mb-2 font-medium">No celular do assistente:</p>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-4">
              <li>Abra o WhatsApp</li>
              <li>Aparelhos conectados</li>
              <li>Conectar um aparelho</li>
              <li>Aponte para este código</li>
            </ol>
            <Button variant="ghost" size="sm" className="mt-2" onClick={conectar}>
              O código expirou — gerar outro
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={conectar} disabled={conectando}>
          <QrCode className="size-4" />
          {conectando ? 'Gerando...' : 'Conectar WhatsApp'}
        </Button>
      )}
    </Card>
  )
}
