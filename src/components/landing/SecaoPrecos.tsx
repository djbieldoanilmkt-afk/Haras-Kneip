import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { MOEDA, PLANOS } from '@/lib/planos'
import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'

/**
 * Preços na página, à vista.
 *
 * Todos os concorrentes escondem valor atrás de "fale conosco". Publicar tira
 * atrito de quem quer decidir às 22h sem falar com vendedor — e é o tipo de
 * transparência que o público de maior poder aquisitivo lê como confiança,
 * não como commodity.
 */
export function SecaoPrecos() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()
  const [anual, setAnual] = useState(false)

  return (
    <section id="precos" className="border-y border-black/8 bg-white py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center">
          <p className="text-primary text-xs font-bold tracking-widest uppercase">Planos</p>
          <h2 className="font-heading mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Preço na mesa, sem precisar ligar para ninguém
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#6B7280]">
            Todos os planos incluem {PRODUTO.trialDias} dias grátis, sem cartão de crédito.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-black/8 bg-[#F4F6F5] p-1 text-sm">
            {[
              { rotulo: 'Mensal', valor: false },
              { rotulo: 'Anual · 2 meses grátis', valor: true },
            ].map(({ rotulo, valor }) => (
              <button
                key={rotulo}
                type="button"
                onClick={() => setAnual(valor)}
                aria-pressed={anual === valor}
                className={cn(
                  'rounded-full px-4 py-1.5 font-medium transition-colors',
                  anual === valor ? 'bg-white shadow-sm' : 'text-[#6B7280]',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div ref={ref} className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANOS.map((plano, i) => (
            <div
              key={plano.id}
              className={cn(
                'revelar flex flex-col rounded-2xl border bg-white p-6',
                revelado && 'revelado',
                plano.destaque
                  ? 'border-primary shadow-lg lg:-my-3 lg:py-9'
                  : 'border-black/8 shadow-sm',
              )}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {plano.destaque && (
                <span className="bg-primary mb-3 self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  Mais escolhido
                </span>
              )}

              <h3 className="font-heading text-lg font-bold">{plano.nome}</h3>
              <p className="text-sm text-[#6B7280]">{plano.resumo}</p>

              <div className="mt-5">
                <span className="font-heading text-3xl font-extrabold tracking-tight">
                  {MOEDA.format(anual ? Math.round(plano.precoAnual / 12) : plano.precoMensal)}
                </span>
                <span className="text-sm text-[#6B7280]">/mês</span>
                {anual && (
                  <p className="mt-1 text-xs text-[#868C96]">
                    {MOEDA.format(plano.precoAnual)} por ano
                  </p>
                )}
              </div>

              <dl className="mt-4 space-y-1 border-y border-black/8 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">Animais</dt>
                  <dd className="font-medium">{plano.animais}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">Usuários</dt>
                  <dd className="font-medium">{plano.usuarios}</dd>
                </div>
              </dl>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plano.recursos.map((recurso) => (
                  <li key={recurso} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span className="text-[#374151]">{recurso}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full"
                variant={plano.destaque ? 'default' : 'outline'}
                nativeButton={false}
                render={<Link to="/criar-conta" />}
              >
                Começar grátis
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[#868C96]">
          Precisa de mais? Fale com a gente e montamos o plano do seu haras.
        </p>
      </div>
    </section>
  )
}
