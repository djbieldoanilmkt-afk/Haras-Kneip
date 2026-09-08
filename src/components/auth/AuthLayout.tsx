import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { MarcaProduto } from '@/components/MarcaProduto'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { PRODUTO } from '@/lib/produto'

/**
 * Moldura das telas de autenticação, em duas colunas.
 *
 * Esquerda: vídeo do haras em tela cheia, com gradiente e texto por cima —
 * é o que dá contexto emocional antes de pedir e-mail e senha. Some no
 * celular, onde a tela é do formulário.
 *
 * Direita: o formulário direto sobre branco, sem caixa. Card branco sobre
 * fundo branco só desenha uma borda inútil.
 *
 * Tema claro forçado, como na landing e na vitrine: é página pública, e a
 * preferência do administrador não vale para quem chega de fora.
 */

const PROVAS = [
  'Plantel, genealogia e sanidade num lugar só',
  'Vitrine pública pronta para o WhatsApp',
  `${PRODUTO.trialDias} dias grátis, sem cartão de crédito`,
] as const

function PainelVisual() {
  const menosMovimento = useReducedMotion()
  const [semVideo, setSemVideo] = useState(false)

  return (
    <div className="relative hidden overflow-hidden bg-[#14201A] lg:block">
      {!semVideo && !menosMovimento && (
        <video
          src="assets/haras-drone.webm"
          poster="assets/haras-drone-poster.webp"
          autoPlay
          muted
          loop
          playsInline
          // Sem o arquivo, o painel continua elegante: fica o fundo escuro da
          // marca com o texto por cima, sem buraco nem ícone de mídia quebrada.
          onError={() => setSemVideo(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#0C1611] via-[#0C1611]/55 to-[#0C1611]/25" />

      <div className="relative flex h-full flex-col justify-between p-10">
        <Link to="/" className="w-fit">
          <MarcaProduto tom="sobre-escuro" className="h-8" />
        </Link>

        <div className="max-w-sm">
          <p className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white">
            O seu haras merece mais que uma planilha.
          </p>

          <ul className="mt-6 space-y-2.5">
            {PROVAS.map((prova) => (
              <li key={prova} className="flex items-start gap-2.5 text-sm text-white/80">
                <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                {prova}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
  rodape?: ReactNode
}) {
  useEffect(() => {
    const raiz = document.documentElement
    const tinhaDark = raiz.classList.contains('dark')
    raiz.classList.remove('dark')
    return () => {
      if (tinhaDark) raiz.classList.add('dark')
    }
  }, [])

  return (
    <div className="grid min-h-screen bg-white text-[#14161A] lg:grid-cols-[1.1fr_1fr]">
      <PainelVisual />

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* No celular a marca aparece aqui, já que o painel some. */}
          <Link to="/" className="mb-8 flex justify-center lg:hidden">
            <MarcaProduto tom="sobre-claro" className="h-8" />
          </Link>

          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{titulo}</h1>
          {descricao && <p className="mt-2 text-sm text-[#6B7280]">{descricao}</p>}

          <div className="mt-7">{children}</div>

          {rodape && <div className="mt-6 text-center text-sm text-[#6B7280]">{rodape}</div>}
        </div>
      </div>
    </div>
  )
}
