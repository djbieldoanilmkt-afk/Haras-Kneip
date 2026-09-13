import { useEffect, useState } from 'react'
import { Check, Mic } from 'lucide-react'

import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

/**
 * Demonstração do agente de WhatsApp num celular animado.
 *
 * Em código, não em vídeo: fica nítido em qualquer tela, pesa alguns KB em vez
 * de megabytes, e acompanha o produto quando o fluxo mudar.
 *
 * ATENÇÃO: o agente ainda NÃO existe. A seção é marcada como "Em breve" de
 * propósito — anunciar como pronto seria vender o que não entregamos.
 */

const PASSOS = [
  { atraso: 400 }, // áudio chega
  { atraso: 1400 }, // transcrevendo
  { atraso: 2600 }, // transcrição aparece
  { atraso: 3800 }, // sistema confirma
] as const

function Onda() {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {[9, 15, 22, 13, 19, 8, 16, 11, 20, 14, 7, 17].map((altura, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current opacity-70"
          style={{ height: altura }}
        />
      ))}
    </span>
  )
}

function Balao({
  children,
  lado,
  visivel,
  className,
}: {
  children: React.ReactNode
  lado: 'entrada' | 'saida'
  visivel: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex transition-all duration-500',
        lado === 'saida' ? 'justify-end' : 'justify-start',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] shadow-sm',
          lado === 'saida'
            ? 'rounded-br-sm bg-[#D9FDD3] text-[#111B21]'
            : 'rounded-bl-sm bg-white text-[#111B21]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function SecaoWhatsApp() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()
  const menosMovimento = useReducedMotion()
  const [passo, setPasso] = useState(-1)

  useEffect(() => {
    if (!revelado) return

    // Sem movimento: a conversa aparece inteira, sem encenação.
    if (menosMovimento) {
      setPasso(PASSOS.length - 1)
      return
    }

    const timers = PASSOS.map((p, i) => window.setTimeout(() => setPasso(i), p.atraso))
    return () => timers.forEach(clearTimeout)
  }, [revelado, menosMovimento])

  return (
    <section className="bg-[#F4F6F5] py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-primary text-xs font-bold tracking-widest uppercase">
              Assistente no WhatsApp
            </p>
            <span className="rounded-full bg-[#B45309]/12 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#B45309] uppercase">
              Em breve
            </span>
          </div>

          <h2 className="font-heading mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Registre pelo áudio, do curral
          </h2>

          <p className="mt-3 text-sm text-[#6B7280]">
            O problema do controle de custo nunca foi o software — é ninguém abrir o computador
            para lançar a nota da ração. Mande um áudio no WhatsApp e o HarasPro entende, organiza
            e pergunta se pode salvar.
          </p>

          <ul className="mt-5 space-y-2.5 text-sm">
            {[
              'Lance despesas falando, sem abrir o sistema',
              'Pergunte qualquer coisa do plantel e receba na hora',
              'Sempre pede confirmação antes de gravar',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="text-[#374151]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div ref={ref} className="flex justify-center">
          {/* Moldura do celular */}
          <div className="w-[300px] rounded-[2rem] border-[10px] border-[#14161A] bg-[#14161A] shadow-2xl">
            <div className="overflow-hidden rounded-[1.4rem] bg-[#EFE7DE]">
              <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5 text-white">
                <div className="font-brand flex size-7 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold">
                  HP
                </div>
                <div className="leading-tight">
                  <p className="text-[13px] font-semibold">HarasPro</p>
                  <p className="text-[10px] text-white/70">online</p>
                </div>
              </div>

              <div className="flex min-h-[19rem] flex-col justify-end gap-2 p-3">
                <Balao lado="saida" visivel={passo >= 0}>
                  <span className="flex items-center gap-2 text-[#075E54]">
                    <Mic className="size-4 shrink-0" />
                    <Onda />
                    <span className="text-[11px] text-[#111B21]/60">0:07</span>
                  </span>
                </Balao>

                <Balao lado="entrada" visivel={passo >= 1} className="text-[#111B21]/60 italic">
                  {passo >= 2 ? (
                    <span className="text-[#111B21] not-italic">
                      “Comprei oito sacas de ração hoje, deu mil e duzentos reais.”
                    </span>
                  ) : (
                    'transcrevendo…'
                  )}
                </Balao>

                <Balao lado="entrada" visivel={passo >= 3}>
                  <p className="font-semibold">Despesa registrada?</p>
                  <dl className="mt-1.5 space-y-0.5 text-[12px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#111B21]/60">Categoria</dt>
                      <dd className="font-medium">Alimentação</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#111B21]/60">Valor</dt>
                      <dd className="font-medium">R$ 1.200,00</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#111B21]/60">Rateio</dt>
                      <dd className="font-medium">9 animais</dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex gap-1.5">
                    <span className="bg-primary rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
                      Confirmar
                    </span>
                    <span className="rounded-full bg-black/8 px-2.5 py-1 text-[11px] font-semibold">
                      Corrigir
                    </span>
                  </div>
                </Balao>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
