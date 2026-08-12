import { Link } from 'react-router-dom'

import type { Genealogia } from '@/lib/database.types'

type Nomes = Record<string, string>

/**
 * Árvore genealógica em três colunas: animal, pais, avós.
 *
 * Esta é a primeira versão que funciona. O componente legado
 * (js/components/pedigreeTree.js) declarava `renderPedigreeTree(genealogia,
 * animaisMap)` e devolvia uma string HTML, mas js/pages/profile.js:177 chamava
 * com três argumentos, tratando o primeiro como container, e descartava o
 * retorno — então a árvore nunca aparecia na tela.
 */
function Box({ id, label, nomes }: { id: string | null; label: string; nomes: Nomes }) {
  const nome = id ? nomes[id] : undefined
  const conhecido = Boolean(nome)

  const conteudo = (
    <>
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{nome ?? 'Desconhecido'}</div>
    </>
  )

  if (!conhecido || !id) {
    return (
      <div className="border-border bg-card text-muted-foreground w-40 shrink-0 rounded-lg border border-dashed p-2.5 text-center">
        {conteudo}
      </div>
    )
  }

  return (
    <Link
      to={`/animal/${id}`}
      className="border-border bg-card hover:border-primary hover:bg-accent w-40 shrink-0 rounded-lg border p-2.5 text-center transition-colors"
    >
      {conteudo}
    </Link>
  )
}

export function PedigreeTree({
  genealogia,
  nomes,
  animalNome,
}: {
  genealogia: Genealogia | null
  nomes: Nomes
  animalNome: string
}) {
  if (!genealogia) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Sem dados de genealogia. Use "Editar genealogia" para informar pai e mãe.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-6 overflow-x-auto p-2">
      <div className="flex flex-col justify-center">
        <div className="border-primary bg-card w-40 shrink-0 rounded-lg border-2 p-2.5 text-center">
          <div className="text-muted-foreground text-[11px] tracking-wide uppercase">Animal</div>
          <div className="mt-1 truncate text-sm font-semibold">{animalNome}</div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <Box id={genealogia.pai_id} label="Pai" nomes={nomes} />
        <Box id={genealogia.mae_id} label="Mãe" nomes={nomes} />
      </div>

      <div className="flex flex-col gap-3">
        <Box id={genealogia.avo_paterno_id} label="Avô paterno" nomes={nomes} />
        <Box id={genealogia.avo_paterna_id} label="Avó paterna" nomes={nomes} />
        <Box id={genealogia.avo_materno_id} label="Avô materno" nomes={nomes} />
        <Box id={genealogia.avo_materna_id} label="Avó materna" nomes={nomes} />
      </div>
    </div>
  )
}
