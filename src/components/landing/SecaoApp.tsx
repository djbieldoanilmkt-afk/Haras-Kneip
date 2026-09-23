import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { cn } from '@/lib/utils'

/**
 * O app dentro de molduras de notebook e celular.
 *
 * As telas são recriadas em HTML, não capturadas em imagem: ficam nítidas em
 * qualquer resolução, pesam alguns KB e não envelhecem quando o produto muda.
 * Captura de tela numa landing é dívida — no dia em que a interface muda, ela
 * passa a mentir.
 */

const METRICAS = [
  { valor: '47', rotulo: 'Animais' },
  { valor: '08', rotulo: 'Prenhas' },
  { valor: '05', rotulo: 'Lactantes' },
  { valor: '03', rotulo: 'Eventos' },
] as const

const NAV = ['Painel', 'Plantel', 'Calendário', 'Relatórios'] as const

const ANIMAIS = [
  { nome: 'Estrela D’Alva', detalhe: 'Tordilha · 7 anos', status: 'Prenha' },
  { nome: 'Imperador do Vale', detalhe: 'Castanho · 11 anos', status: 'Garanhão' },
  { nome: 'Brisa Suave', detalhe: 'Alazã · 10 anos', status: 'Vazia' },
] as const

function TelaPainel() {
  return (
    <div className="flex h-full bg-[#FBFBFC] text-[#14161A]">
      <aside className="hidden w-[86px] shrink-0 border-r border-black/8 bg-white p-2 sm:block">
        <div className="mb-3 flex items-center gap-1 px-1">
          <div className="bg-primary size-4 rounded" />
          <div className="h-1.5 w-8 rounded bg-black/15" />
        </div>
        {NAV.map((item, i) => (
          <div
            key={item}
            className={cn(
              'mb-0.5 rounded px-1.5 py-1 text-[7px]',
              i === 0 ? 'bg-accent text-accent-foreground font-semibold' : 'text-[#868C96]',
            )}
          >
            {item}
          </div>
        ))}
      </aside>

      <div className="min-w-0 flex-1 p-3">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="text-[6px] text-[#868C96]">Mangalarga Marchador</div>
            <div className="text-[11px] font-extrabold tracking-tight">Painel do Plantel</div>
          </div>
          <div className="bg-primary rounded px-2 py-1 text-[6px] font-semibold text-white">
            Novo animal
          </div>
        </div>

        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {METRICAS.map((m, i) => (
            <div
              key={m.rotulo}
              className="relative overflow-hidden rounded border border-black/8 bg-white p-1.5"
            >
              {i === 0 && <span className="bg-primary absolute inset-y-0 left-0 w-[2px]" />}
              <div
                className={cn(
                  'text-[13px] leading-none font-extrabold',
                  i === 0 && 'text-primary',
                )}
              >
                {m.valor}
              </div>
              <div className="mt-0.5 text-[5px] tracking-wider text-[#868C96] uppercase">
                {m.rotulo}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded border border-black/8 bg-white p-2">
            <div className="mb-1.5 text-[6px] font-semibold">Distribuição de pelagens</div>
            {/* Rosca desenhada com gradiente cônico: sem biblioteca, sem imagem. */}
            <div
              className="mx-auto size-[52px] rounded-full"
              style={{
                background:
                  'conic-gradient(#8B4513 0 32%, #A9A9A9 0 58%, #D2691E 0 78%, #DAA520 0 92%, #2C1810 0 100%)',
                mask: 'radial-gradient(circle, transparent 56%, #000 57%)',
                WebkitMask: 'radial-gradient(circle, transparent 56%, #000 57%)',
              }}
            />
          </div>

          <div className="rounded border border-black/8 bg-white p-2">
            <div className="mb-1.5 text-[6px] font-semibold">Últimos cadastros</div>
            {ANIMAIS.map((a) => (
              <div key={a.nome} className="flex items-center gap-1.5 border-b border-black/5 py-1">
                <div className="bg-secondary text-primary flex size-4 items-center justify-center rounded-full text-[5px] font-bold">
                  {a.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[6px] font-semibold">{a.nome}</div>
                  <div className="text-[5px] text-[#868C96]">{a.detalhe}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TelaPlantel() {
  return (
    <div className="h-full bg-[#FBFBFC] p-2.5 text-[#14161A]">
      <div className="mb-2 text-[10px] font-extrabold tracking-tight">Plantel</div>
      <div className="mb-2 flex gap-1">
        {['Todos', 'Éguas', 'Garanhões'].map((f, i) => (
          <span
            key={f}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[6px]',
              i === 0 ? 'bg-primary text-white' : 'border border-black/10 text-[#6B7280]',
            )}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {ANIMAIS.slice(0, 4).map((a) => (
          <div key={a.nome} className="overflow-hidden rounded border border-black/8 bg-white">
            <div className="bg-secondary text-primary flex h-9 items-center justify-center text-[10px] font-bold">
              {a.nome.slice(0, 2).toUpperCase()}
            </div>
            <div className="p-1">
              <div className="truncate text-[6px] font-semibold">{a.nome}</div>
              <div className="text-[5px] text-[#868C96]">{a.detalhe}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SecaoApp() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()

  return (
    <section className="bg-[#F4F6F5] py-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-primary text-xs font-bold tracking-widest uppercase">O sistema</p>
        <h2 className="font-heading mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          No escritório e no bolso
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-[#6B7280]">
          A mesma informação nas duas telas. Cadastre no curral pelo celular, analise no
          computador quando sentar.
        </p>

        <div
          ref={ref}
          className={cn(
            'revelar relative mt-12 flex items-end justify-center',
            revelado && 'revelado',
          )}
        >
          {/* Notebook */}
          <div className="w-full max-w-2xl">
            <div className="rounded-t-xl border-[6px] border-b-0 border-[#14161A] bg-[#14161A]">
              <div className="aspect-[16/10] overflow-hidden rounded-t-md bg-white">
                <TelaPainel />
              </div>
            </div>
            <div className="h-2 rounded-b-xl bg-[#2A2D33]" />
            <div className="mx-auto h-1 w-24 rounded-b bg-[#14161A]/40" />
          </div>

          {/* Celular sobreposto */}
          <div className="absolute -right-1 bottom-0 w-[104px] sm:right-4 sm:w-[128px]">
            <div className="rounded-[1.1rem] border-[5px] border-[#14161A] bg-[#14161A] shadow-xl">
              <div className="aspect-[9/17] overflow-hidden rounded-[0.7rem] bg-white">
                <TelaPlantel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
