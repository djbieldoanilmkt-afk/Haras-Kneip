import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, TriangleAlert } from 'lucide-react'

import { MarcaProduto } from '@/components/MarcaProduto'
import { Rodape } from '@/components/landing/Rodape'
import { EMPRESA, TEM_DADOS_LEGAIS } from '@/lib/empresa'
import { formatDate } from '@/lib/format'

/** Moldura comum das páginas legais, sempre em tema claro como a landing. */
export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  useEffect(() => {
    const raiz = document.documentElement
    const tinhaDark = raiz.classList.contains('dark')
    raiz.classList.remove('dark')
    return () => {
      if (tinhaDark) raiz.classList.add('dark')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-[#14161A]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/">
          <MarcaProduto tom="sobre-claro" className="h-7" />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-[#868C96]">
          Última atualização: {formatDate(EMPRESA.atualizadoEm)}
        </p>

        {!TEM_DADOS_LEGAIS && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#B45309]/25 bg-[#B45309]/8 p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#B45309]" />
            <div className="text-sm">
              <p className="font-semibold text-[#B45309]">Documento ainda não finalizado</p>
              <p className="mt-1 text-[#6B7280]">
                Falta preencher a razão social e o CNPJ do responsável (em{' '}
                <code className="rounded bg-black/5 px-1">src/lib/empresa.ts</code>) e submeter o
                texto à revisão de um advogado antes de cobrar do primeiro cliente.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[#374151]">{children}</div>
      </main>

      <Rodape />
    </div>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading mb-2 text-base font-bold">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
