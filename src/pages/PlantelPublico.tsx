import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { StatusBadge } from '@/components/StatusBadge'
import { iniciais } from '@/components/AnimalCard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { store } from '@/lib/store'
import { calcularIdade } from '@/lib/format'
import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'
import type { Animal } from '@/lib/database.types'

const PLAYLIST = [
  'assets/plantel-bg.mp4',
  'assets/plantel-bg-2.mp4',
  'assets/plantel-bg-3.mp4',
]

/**
 * Revela o card quando ele entra na tela ao rolar — o único lugar do app onde
 * scroll-trigger cabe: grade longa, lida de cima a baixo, quase sempre no
 * celular. Revela uma vez só; rolar de volta não desfaz.
 */
function CardRevelavel({ children, atraso }: { children: ReactNode; atraso: number }) {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn('revelar', revelado && 'revelado')}
      style={{ transitionDelay: `${atraso}ms` }}
    >
      {children}
    </div>
  )
}

/**
 * Vitrine pública do plantel.
 *
 * Roda fora do shell (sem sidebar) e fica travada no tema claro: é a página
 * que estranhos veem, e foto de animal pede fundo claro. Por isso as cores
 * aqui são literais, não tokens do tema.
 */
export default function PlantelPublico() {
  const { slug = '' } = useParams()

  const { data, loading } = useAsync(async () => {
    const haras = await store.getHarasPorSlug(slug)
    if (!haras) return { haras: null, animais: [], genealogias: [] }
    const vitrine = await store.getVitrine(haras.id)
    return { haras, ...vitrine }
  }, [slug])

  const [videoIndex, setVideoIndex] = useState(0)
  const [selecionado, setSelecionado] = useState<Animal | null>(null)

  const haras = data?.haras ?? null
  const animais = useMemo(() => data?.animais ?? [], [data])
  const genealogias = useMemo(() => data?.genealogias ?? [], [data])

  const linhagens = useMemo(() => {
    const nomes = new Map(animais.map((a) => [a.id, a.nome]))
    const mapa: Record<string, { pai_nome: string | null; mae_nome: string | null }> = {}
    for (const g of genealogias) {
      mapa[g.animal_id] = {
        pai_nome: g.pai_id ? (nomes.get(g.pai_id) ?? null) : null,
        mae_nome: g.mae_id ? (nomes.get(g.mae_id) ?? null) : null,
      }
    }
    return mapa
  }, [animais, genealogias])

  // A vitrine ignora a preferencia de tema do administrador.
  useEffect(() => {
    const raiz = document.documentElement
    const tinhaDark = raiz.classList.contains('dark')
    raiz.classList.remove('dark')
    return () => {
      if (tinhaDark) raiz.classList.add('dark')
    }
  }, [])

  const linhagemSelecionada = selecionado ? linhagens[selecionado.id] : undefined

  // Haras inexistente, ou conta suspensa (o RLS devolve nada nesse caso).
  if (!loading && !haras) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FBFBFC] p-6 text-center text-[#14161A]">
        <div>
          <h1 className="font-heading text-xl font-bold">Vitrine indisponível</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Este endereço não corresponde a nenhum plantel ativo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] px-4 py-8 text-[#14161A]">
      <header className="relative mx-auto mb-8 max-w-5xl overflow-hidden rounded-2xl bg-[#14201A] px-6 py-14 text-center">
        <video
          key={videoIndex}
          src={PLAYLIST[videoIndex]}
          autoPlay
          muted
          playsInline
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-40"
          onEnded={() => setVideoIndex((i) => (i + 1) % PLAYLIST.length)}
          onError={() => setVideoIndex(0)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#14201A]/40 to-[#14201A]/90" />

        <div className="relative">
          {haras?.logo_url ? (
            /*
              `object-contain` e largura livre, nao `size-14 object-cover`.

              A logo do haras e oval e larga; uma caixa quadrada com recorte
              cortava as laterais e comia o nome. Aqui ela e a primeira coisa
              que o comprador ve — tem de aparecer inteira.
            */
            <img
              src={haras.logo_url}
              alt={haras.nome}
              className="mx-auto mb-4 h-24 w-auto max-w-[260px] object-contain sm:h-28"
            />
          ) : (
            <div className="font-brand mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-[#1E5B3A] text-lg font-bold text-white">
              {iniciais(haras?.nome ?? null)}
            </div>
          )}
          <h1 className="font-brand text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {haras?.nome ?? ''}
          </h1>
          <p className="mt-2 text-sm text-white/80">Seleção & Plantel Mangalarga Marchador</p>
          <span className="mt-5 inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            Apresentação oficial do plantel
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : animais.length === 0 ? (
          <div className="rounded-xl border border-black/8 bg-white p-12 text-center">
            <p className="text-[#6B7280]">
              Nenhum animal está marcado para apresentação pública no momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {animais.map((a, i) => {
              const linhagem = linhagens[a.id]
              return (
                /* i % 3: o atraso escalona por posicao na linha da grade — o
                   quarto card abre uma linha nova e entra junto com o primeiro
                   dela, nao 240ms depois. */
                <CardRevelavel key={a.id} atraso={(i % 3) * 80}>
                <button
                  type="button"
                  onClick={() => setSelecionado(a)}
                  className="w-full overflow-hidden rounded-xl border border-black/8 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative h-44 bg-[#EEF0F3]">
                    {a.foto_url ? (
                      <img src={a.foto_url} alt={a.nome} className="size-full object-cover" />
                    ) : (
                      <div className="font-brand flex size-full items-center justify-center text-3xl font-bold text-[#1E5B3A]">
                        {iniciais(a.nome)}
                      </div>
                    )}
                    <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-white text-sm font-bold shadow">
                      {a.sexo === 'Fêmea' ? '♀' : '♂'}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold">{a.nome}</h2>
                      <StatusBadge status={a.status_reprodutivo} />
                    </div>
                    <p className="text-sm text-[#6B7280]">
                      {a.pelagem}
                      {a.tipo_marcha ? ` • ${a.tipo_marcha}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[#868C96]">
                      {calcularIdade(a.data_nascimento)}
                      {a.registro_abccmm ? ` · Reg. ${a.registro_abccmm}` : ''}
                    </p>

                    {a.premiacao && (
                      <p className="mt-2 text-xs font-semibold text-[#1E5B3A]">{a.premiacao}</p>
                    )}

                    {(linhagem?.pai_nome || linhagem?.mae_nome) && (
                      <div className="mt-3 space-y-0.5 border-t border-black/8 pt-2.5 text-xs text-[#868C96]">
                        {linhagem.pai_nome && <div>Pai: {linhagem.pai_nome}</div>}
                        {linhagem.mae_nome && <div>Mãe: {linhagem.mae_nome}</div>}
                      </div>
                    )}
                  </div>
                </button>
                </CardRevelavel>
              )
            })}
          </div>
        )}
      </main>

      <footer className="mx-auto mt-12 max-w-5xl border-t border-black/8 pt-6 text-center text-xs text-[#868C96]">
        <p>
          {haras?.nome} © {new Date().getFullYear()} — Excelência em Mangalarga Marchador
        </p>
        {/* Cada vitrine compartilhada no WhatsApp e distribuicao do produto. */}
        <p className="mt-2">
          Feito com{' '}
          <a href={window.location.pathname} className="font-medium hover:underline">
            {PRODUTO.nome}
          </a>
        </p>
      </footer>

      <Dialog open={Boolean(selecionado)} onOpenChange={(v) => !v && setSelecionado(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto p-0">
          {selecionado && (
            <>
              <div className="h-48 bg-[#EEF0F3]">
                {selecionado.foto_url ? (
                  <img
                    src={selecionado.foto_url}
                    alt={selecionado.nome}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="font-brand flex size-full items-center justify-center text-4xl font-bold text-[#1E5B3A]">
                    {iniciais(selecionado.nome)}
                  </div>
                )}
              </div>

              <div className="p-5">
                <DialogHeader className="mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle className="font-brand text-xl">{selecionado.nome}</DialogTitle>
                    <StatusBadge status={selecionado.status_reprodutivo} />
                  </div>
                </DialogHeader>

                <p className="mb-4 text-sm font-medium text-[#1E5B3A]">
                  {selecionado.pelagem} • {selecionado.tipo_marcha ?? 'Mangalarga Marchador'}
                </p>

                <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-black/8 bg-[#F7F8F9] p-4 text-sm">
                  {(
                    [
                      ['Sexo', selecionado.sexo === 'Fêmea' ? 'Égua ♀' : 'Garanhão ♂'],
                      ['Idade', calcularIdade(selecionado.data_nascimento)],
                      ['Registro ABCCMM', selecionado.registro_abccmm || '--'],
                      ['Localização', selecionado.baia_piquete || '--'],
                    ] as [string, string][]
                  ).map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-xs text-[#868C96]">{rotulo}</dt>
                      <dd className="font-medium">{valor}</dd>
                    </div>
                  ))}
                </dl>

                {(linhagemSelecionada?.pai_nome || linhagemSelecionada?.mae_nome) && (
                  <div className="mb-4 rounded-lg border border-black/8 p-4">
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-[#1E5B3A] uppercase">
                      Genealogia
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="block text-xs text-[#868C96]">Pai</span>
                        {linhagemSelecionada.pai_nome || '--'}
                      </div>
                      <div>
                        <span className="block text-xs text-[#868C96]">Mãe</span>
                        {linhagemSelecionada.mae_nome || '--'}
                      </div>
                    </div>
                  </div>
                )}

                {selecionado.premiacao && (
                  <div className="mb-4 rounded-lg border border-black/8 p-4">
                    <h3 className="mb-1 text-xs font-semibold tracking-wide text-[#1E5B3A] uppercase">
                      Premiações
                    </h3>
                    <p className="text-sm font-medium">{selecionado.premiacao}</p>
                  </div>
                )}

                {selecionado.observacoes && (
                  <div className="text-sm text-[#6B7280]">
                    <h3 className="mb-1 font-medium text-[#14161A]">Observações</h3>
                    <p className="whitespace-pre-wrap">{selecionado.observacoes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
