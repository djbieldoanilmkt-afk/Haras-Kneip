import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { MarcaProduto } from '@/components/MarcaProduto'
import { Card } from '@/components/ui/card'

/** Moldura das telas de autenticação: marca do PRODUTO, não de um haras. */
export function AuthLayout({
  titulo,
  children,
  rodape,
}: {
  titulo: string
  children: ReactNode
  rodape?: ReactNode
}) {
  return (
    <div className="bg-background grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center">
          <MarcaProduto className="h-9" />
        </Link>

        <Card className="p-6">
          <h1 className="mb-4 text-lg font-bold">{titulo}</h1>
          {children}
        </Card>

        {rodape && (
          <div className="text-muted-foreground mt-4 text-center text-sm">{rodape}</div>
        )}
      </div>
    </div>
  )
}
