import { Link } from 'react-router-dom'

import type { Genealogia } from '@/lib/database.types'
import { iniciais } from './AnimalCard'
import { cn } from '@/lib/utils'

type Ancestral = { nome: string; foto_url: string | null }
type Ancestrais = Record<string, Ancestral>

function Miniatura({ ancestral }: { ancestral: Ancestral | null }) {
  return (
    <div className="bg-secondary text-primary font-brand flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-[11px] font-bold">
      {ancestral?.foto_url ? (
        <img src={ancestral.foto_url} alt="" className="size-full object-cover" />
      ) : (
        iniciais(ancestral?.nome ?? null)
      )}
    </div>
  )
}

function Conteudo({ ancestral, rotulo }: { ancestral: Ancestral | null; rotulo: string }) {
  return (
    <>
      <Miniatura ancestral={ancestral} />
      <div className="min-w-0">
        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{rotulo}</div>
        <div className="truncate text-xs font-semibold">{ancestral?.nome ?? 'Desconhecido'}</div>
      </div>
    </>
  )
}

function No({
  id,
  rotulo,
  ancestrais,
  className,
  atraso,
  chave,
  stub,
}: {
  id: string | null
  rotulo: string
  ancestrais: Ancestrais
  className?: string
  atraso: number
  /** Este nó liga um par de filhos à direita (pai/mãe ligando os avós). */
  chave?: boolean
  /** Este nó emite um ramo pela direita até a chave seguinte. */
  stub?: boolean
}) {
  const ancestral = id ? (ancestrais[id] ?? null) : null
  const estilo = { animationDelay: `${atraso}ms` }

  const classes = cn(
    'pedigree-no animar-entrada',
    chave && 'pedigree-chave',
    !ancestral && 'text-muted-foreground border-dashed',
    className,
  )

  const filhos = (
    <>
      <Conteudo ancestral={ancestral} rotulo={rotulo} />
      {stub && <span className="pedigree-stub" aria-hidden />}
    </>
  )

  if (!ancestral || !id) {
    return (
      <div className={classes} data-ramo style={estilo}>
        {filhos}
      </div>
    )
  }

  return (
    <Link
      to={`/animal/${id}`}
      className={cn(classes, 'hover:border-primary hover:bg-accent transition-colors')}
      data-ramo
      style={estilo}
    >
      {filhos}
    </Link>
  )
}

/**
 * Árvore genealógica em três gerações, com conectores no formato de chave de
 * pedigree impresso. As caixas entram em três ondas — animal, pais, avós — e
 * as linhas se desenham junto com a onda que as recebe.
 *
 * Primeira versão funcional: o componente legado devolvia uma string HTML
 * enquanto o chamador passava um container, e a árvore nunca aparecia.
 */
export function PedigreeTree({
  genealogia,
  ancestrais,
  animalNome,
  animalFoto,
}: {
  genealogia: Genealogia | null
  ancestrais: Ancestrais
  animalNome: string
  animalFoto?: string | null
}) {
  if (!genealogia) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Sem dados de genealogia. Use "Editar genealogia" para informar pai e mãe.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto p-2">
      <div className="pedigree">
        <div
          className="pedigree-no pedigree-chave-animal animar-entrada border-primary col-start-1 row-span-4 row-start-1 self-center border-2"
          style={{ animationDelay: '0ms' }}
        >
          <Conteudo
            ancestral={{ nome: animalNome, foto_url: animalFoto ?? null }}
            rotulo="Animal"
          />
          <span className="pedigree-stub" aria-hidden />
        </div>

        <No
          id={genealogia.pai_id}
          rotulo="Pai"
          ancestrais={ancestrais}
          className="col-start-2 row-span-2 row-start-1 self-center"
          atraso={120}
          chave
          stub
        />
        <No
          id={genealogia.mae_id}
          rotulo="Mãe"
          ancestrais={ancestrais}
          className="col-start-2 row-span-2 row-start-3 self-center"
          atraso={120}
          chave
          stub
        />

        <No
          id={genealogia.avo_paterno_id}
          rotulo="Avô paterno"
          ancestrais={ancestrais}
          className="col-start-3 row-start-1"
          atraso={240}
        />
        <No
          id={genealogia.avo_paterna_id}
          rotulo="Avó paterna"
          ancestrais={ancestrais}
          className="col-start-3 row-start-2"
          atraso={240}
        />
        <No
          id={genealogia.avo_materno_id}
          rotulo="Avô materno"
          ancestrais={ancestrais}
          className="col-start-3 row-start-3"
          atraso={240}
        />
        <No
          id={genealogia.avo_materna_id}
          rotulo="Avó materna"
          ancestrais={ancestrais}
          className="col-start-3 row-start-4"
          atraso={240}
        />
      </div>
    </div>
  )
}
