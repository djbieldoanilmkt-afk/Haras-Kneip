import { Link } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { completudeDoCadastro, lacunasDeCadastro } from '@/lib/plantel'
import type { Animal } from '@/lib/database.types'

export function CadastroIncompleto({
  animais,
  carregando,
}: {
  animais: Animal[]
  carregando: boolean
}) {
  const completude = completudeDoCadastro(animais)
  const lacunas = lacunasDeCadastro(animais)

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4" />
          Cadastro do plantel
        </h2>
        <span className="text-sm font-semibold tabular-nums">{completude}%</span>
      </div>

      {carregando ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <>
          <div className="bg-secondary mb-4 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500"
              style={{ width: `${completude}%` }}
            />
          </div>

          {lacunas.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Tudo preenchido. A vitrine está no capricho.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {lacunas.map((l) => (
                  <li key={l.campo} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{l.rotulo}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {l.faltando} {l.faltando > 1 ? 'animais' : 'animal'}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Foto e registro são o que a vitrine mostra ao comprador, então
                  o atalho leva para o plantel, onde se edita animal por animal. */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                nativeButton={false}
                render={<Link to="/catalogo" />}
              >
                Completar no plantel
              </Button>
            </>
          )}
        </>
      )}
    </Card>
  )
}
