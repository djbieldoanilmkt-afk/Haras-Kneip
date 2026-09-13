import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'

import { MarcaProduto } from '@/components/MarcaProduto'
import { EMPRESA, TEM_DADOS_LEGAIS } from '@/lib/empresa'
import { PRODUTO } from '@/lib/produto'

const COLUNAS = [
  {
    titulo: 'Produto',
    itens: [
      { rotulo: 'Planos e preços', para: '/#precos' },
      { rotulo: 'Vitrine de exemplo', para: '/plantel/haras-kneip' },
      { rotulo: 'Criar conta', para: '/criar-conta' },
      { rotulo: 'Entrar', para: '/entrar' },
    ],
  },
  {
    titulo: 'Legal',
    itens: [
      { rotulo: 'Política de privacidade', para: '/privacidade' },
      { rotulo: 'Termos de uso', para: '/termos' },
    ],
  },
] as const

export function Rodape() {
  return (
    <footer className="border-t border-black/8 bg-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <MarcaProduto tom="sobre-claro" className="h-8" />
          <p className="mt-3 max-w-xs text-sm text-[#6B7280]">{PRODUTO.tagline}. Plantel,
            genealogia, sanidade e vitrine pública para criadores.</p>
          <a
            href={`mailto:${EMPRESA.email}`}
            className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm hover:underline"
          >
            <Mail className="size-4" />
            {EMPRESA.email}
          </a>
        </div>

        {COLUNAS.map((coluna) => (
          <div key={coluna.titulo}>
            <h3 className="text-xs font-bold tracking-widest uppercase">{coluna.titulo}</h3>
            <ul className="mt-3 space-y-2">
              {coluna.itens.map((item) => (
                <li key={item.rotulo}>
                  <Link to={item.para} className="text-sm text-[#6B7280] hover:underline">
                    {item.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-black/8 px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-xs text-[#868C96]">
          <p>
            {PRODUTO.nome} © {new Date().getFullYear()}
            {TEM_DADOS_LEGAIS && ` · ${EMPRESA.razaoSocial} · CNPJ ${EMPRESA.cnpj}`}
          </p>
          <p>{EMPRESA.cidade}</p>
        </div>
      </div>
    </footer>
  )
}
