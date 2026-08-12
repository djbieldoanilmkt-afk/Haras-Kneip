import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { Animal } from '@/lib/database.types'
import { calcularIdade } from '@/lib/format'
import { StatusBadge } from './StatusBadge'

/** Duas primeiras iniciais do nome, com HK como fallback. */
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return 'HK'
  const letras = nome
    .split(' ')
    .filter(Boolean)
    .map((palavra) => palavra[0])
    .slice(0, 2)
    .join('')
  return letras ? letras.toUpperCase() : 'HK'
}

/**
 * Substitui js/components/animalCard.js, incluindo as 130 linhas de CSS com
 * !important que aquele arquivo injetava no head para isolar o próprio estilo.
 */
export function AnimalCard({
  animal,
  linhagem,
  footer,
}: {
  animal: Animal
  linhagem?: { pai_nome: string | null; mae_nome: string | null }
  footer?: ReactNode
}) {
  const temLinhagem = Boolean(linhagem?.pai_nome || linhagem?.mae_nome)

  return (
    <article className="border-border bg-card overflow-hidden rounded-lg border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/animal/${animal.id}`} className="block">
        <div className="bg-secondary relative h-32">
          {animal.foto_url ? (
            <img src={animal.foto_url} alt={animal.nome} className="size-full object-cover" />
          ) : (
            <div className="font-brand text-primary flex size-full items-center justify-center text-2xl font-bold">
              {iniciais(animal.nome)}
            </div>
          )}
          <span
            className="bg-card absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-bold shadow-sm"
            aria-label={animal.sexo === 'Fêmea' ? 'Fêmea' : 'Macho'}
          >
            {animal.sexo === 'Fêmea' ? '♀' : '♂'}
          </span>
        </div>

        <div className="space-y-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{animal.nome}</h3>
            <StatusBadge status={animal.status_reprodutivo} />
          </div>

          <p className="text-muted-foreground text-xs">
            {animal.pelagem}
            {animal.tipo_marcha ? ` • ${animal.tipo_marcha}` : ''}
          </p>
          <p className="text-muted-foreground text-xs">{calcularIdade(animal.data_nascimento)}</p>

          {temLinhagem && (
            <div className="border-border text-muted-foreground mt-2 space-y-0.5 border-t pt-2 text-[11px]">
              {linhagem?.pai_nome && <div>Pai: {linhagem.pai_nome}</div>}
              {linhagem?.mae_nome && <div>Mãe: {linhagem.mae_nome}</div>}
            </div>
          )}
        </div>
      </Link>

      {footer}
    </article>
  )
}
