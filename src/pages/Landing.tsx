import { useEffect, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarCheck,
  GitBranch,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MarcaProduto } from '@/components/MarcaProduto'
import { VideoCavalo } from '@/components/landing/VideoCavalo'
import { SecaoGenealogia } from '@/components/landing/SecaoGenealogia'
import { SecaoWhatsApp } from '@/components/landing/SecaoWhatsApp'
import { ContadorReal } from '@/components/landing/ContadorReal'
import { useSession } from '@/hooks/useSession'
import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'

function Revelavel({ children, atraso = 0 }: { children: ReactNode; atraso?: number }) {
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

const FUNCIONALIDADES = [
  {
    icone: GitBranch,
    titulo: 'Genealogia visual',
    texto: 'Árvore de pedigree em três gerações, com foto e navegação entre ancestrais.',
  },
  {
    icone: Share2,
    titulo: 'Vitrine pública',
    texto: 'Um link com seus animais à venda, pronto para mandar no WhatsApp — genealogia inclusa.',
  },
  {
    icone: CalendarCheck,
    titulo: 'Calendário do plantel',
    texto: 'Vacinação, vermifugação, partos previstos e ferração num lugar só, com alertas no painel.',
  },
  {
    icone: BarChart3,
    titulo: 'Relatórios',
    texto: 'Distribuição por pelagem, idade e status reprodutivo, com exportação em CSV.',
  },
  {
    icone: ShieldCheck,
    titulo: 'Registros de saúde e reprodução',
    texto: 'Histórico completo por animal: exames, coberturas, gestações, pesagens e anotações.',
  },
  {
    icone: Smartphone,
    titulo: 'Funciona no celular',
    texto: 'Cadastre no curral, consulte na pista. Tema claro e escuro.',
  },
] as const

/** Landing pública do produto. Quem já está logado vai direto ao painel. */
export default function Landing() {
  const { session, carregando } = useSession()

  // Pagina publica de marketing: fundo claro fixo, como a vitrine. A
  // preferencia de tema do administrador nao vale para quem chega de fora.
  useEffect(() => {
    const raiz = document.documentElement
    const tinhaDark = raiz.classList.contains('dark')
    raiz.classList.remove('dark')
    return () => {
      if (tinhaDark) raiz.classList.add('dark')
    }
  }, [])

  if (!carregando && session) return <Navigate to="/painel" replace />

  return (
    <div className="bg-[#FBFBFC] text-[#14161A]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <MarcaProduto tom="sobre-claro" className="h-8" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/entrar" />}>
            Entrar
          </Button>
          <Button size="sm" nativeButton={false} render={<Link to="/criar-conta" />}>
            Criar conta
          </Button>
        </div>
      </header>

      {/* Herói: o cavalo fica sobre a página, sem moldura. Exige fundo claro —
          ver a explicação do multiply em VideoCavalo. */}
      <section className="mx-auto grid max-w-5xl items-center gap-4 px-4 py-10 lg:grid-cols-2 lg:py-16">
        <div className="text-center lg:text-left">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            {PRODUTO.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[#6B7280] lg:mx-0">
            Plantel, genealogia, sanidade, reprodução e uma vitrine pública para vender — feito
            para criadores, não para contadores.
          </p>
          <div className="mt-8 flex justify-center gap-3 lg:justify-start">
            <Button size="lg" nativeButton={false} render={<Link to="/criar-conta" />}>
              Testar grátis por {PRODUTO.trialDias} dias
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#868C96]">Sem cartão de crédito no teste.</p>
        </div>

        <VideoCavalo
          nome="heroi"
          alt="Cavalo Mangalarga Marchador em pé"
          className="h-[22rem] sm:h-[26rem] lg:h-[32rem]"
        />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-heading text-center text-2xl font-extrabold tracking-tight">
          O que vem dentro
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONALIDADES.map((f, i) => (
            <Revelavel key={f.titulo} atraso={(i % 3) * 80}>
              <div className="h-full rounded-xl border border-black/8 bg-white p-5 shadow-sm">
                <f.icone className="text-primary size-6" />
                <h3 className="font-heading mt-3 text-base font-bold">{f.titulo}</h3>
                <p className="mt-1.5 text-sm text-[#6B7280]">{f.texto}</p>
              </div>
            </Revelavel>
          ))}
        </div>
      </section>

      <ContadorReal />

      {/* Cavalo caminhando como divisor entre seções, sem caixa nem borda. */}
      <div className="mx-auto max-w-5xl overflow-hidden px-4">
        <VideoCavalo
          nome="transicao"
          alt="Cavalo caminhando em marcha"
          className="h-40 sm:h-56 lg:h-64"
        />
      </div>

      <SecaoGenealogia />
      <SecaoWhatsApp />

      <section className="mx-auto max-w-5xl px-4 py-16">
        <Revelavel>
          <div className="grid items-center gap-6 rounded-2xl border border-black/8 bg-white p-8 shadow-sm sm:grid-cols-2 sm:p-10">
            <div className="text-center sm:text-left">
              <h2 className="font-heading text-2xl font-extrabold tracking-tight">
                Comece hoje, com o plantel que você já tem
              </h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                Crie a conta, cadastre os primeiros animais e mande o link da vitrine no grupo de
                criadores ainda esta semana.
              </p>
              <Button
                className="mt-6"
                size="lg"
                nativeButton={false}
                render={<Link to="/criar-conta" />}
              >
                Criar conta grátis
              </Button>
            </div>

            <VideoCavalo
              nome="fechamento"
              alt="Retrato de cavalo Mangalarga Marchador"
              className="h-56 sm:h-64"
            />
          </div>
        </Revelavel>
      </section>

      <footer className="mx-auto max-w-5xl border-t border-black/8 px-4 py-6 text-center text-xs text-[#868C96]">
        {PRODUTO.nome} © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
