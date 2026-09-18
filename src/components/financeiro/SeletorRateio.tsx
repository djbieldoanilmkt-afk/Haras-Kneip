import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { paraCentavos, paraReais, ratearCentavos } from '@/lib/dinheiro'
import { cn } from '@/lib/utils'
import type { Animal } from '@/lib/database.types'

/**
 * Escolha dos animais que dividem a despesa.
 *
 * O valor por cabeça aparece enquanto a pessoa marca, e não só depois de
 * salvar: rateio é a parte do lançamento em que mais se erra, e ver
 * "R$ 133,34 cada" na hora denuncia na mesma tela o animal marcado por
 * engano ou o valor digitado com uma casa a mais.
 */
export function SeletorRateio({
  animais,
  selecionados,
  onChange,
  valorTotal,
}: {
  animais: Animal[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  valorTotal: number
}) {
  const partes =
    selecionados.length > 0 ? ratearCentavos(paraCentavos(valorTotal), selecionados.length) : []

  // As partes diferem no máximo em um centavo, então mostrar a primeira e a
  // última cobre o intervalo inteiro sem listar animal por animal.
  const maior = partes.length > 0 ? paraReais(Math.max(...partes)) : 0
  const menor = partes.length > 0 ? paraReais(Math.min(...partes)) : 0

  function alternar(id: string) {
    onChange(
      selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id],
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          {selecionados.length === 0 ? (
            'Sem rateio — a despesa fica no haras'
          ) : (
            <>
              {selecionados.length} {selecionados.length > 1 ? 'animais' : 'animal'} ·{' '}
              <span className="text-foreground font-medium">
                {maior === menor
                  ? `${formatBRL(maior)} cada`
                  : `${formatBRL(menor)} a ${formatBRL(maior)} cada`}
              </span>
            </>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(animais.map((a) => a.id))}
          >
            Todos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Nenhum
          </Button>
        </div>
      </div>

      {animais.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nenhum animal cadastrado para ratear.</p>
      ) : (
        <div className="border-border max-h-44 overflow-y-auto rounded-md border p-1">
          {animais.map((a) => {
            const marcado = selecionados.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => alternar(a.id)}
                aria-pressed={marcado}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  marcado ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                    marcado ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {marcado ? '✓' : ''}
                </span>
                <span className="truncate">{a.nome}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
