import { useTheme } from '@/hooks/useTheme'
import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'

/**
 * Marca do PRODUTO (HarasPro), não a do haras do cliente.
 *
 * Aparece na landing, nas telas de autenticação, no favicon e no selo da
 * vitrine. A sidebar e o herói da vitrine usam a marca do cliente — misturar
 * as duas faria o criador sentir que a vitrine é nossa, não dele.
 *
 * O `tom` é explícito de propósito. A variante clara existe porque o "aras" é
 * grafite e some no escuro; se ela seguisse cegamente a preferência de tema,
 * apareceria clara sobre a landing — que tem fundo claro fixo — e sumiria.
 */
export function MarcaProduto({
  variante = 'completo',
  tom = 'auto',
  className,
}: {
  variante?: 'completo' | 'marca'
  /** `auto` segue o tema do app; os demais são para fundos de cor fixa. */
  tom?: 'auto' | 'sobre-claro' | 'sobre-escuro'
  className?: string
}) {
  const { theme } = useTheme()
  const usarClara = tom === 'sobre-escuro' || (tom === 'auto' && theme === 'dark')

  const arquivo =
    variante === 'marca'
      ? usarClara
        ? 'haraspro-marca-clara.png'
        : 'haraspro-marca.png'
      : usarClara
        ? 'haraspro-completo-claro.png'
        : 'haraspro-completo.png'

  return (
    <img
      src={`marca/${arquivo}`}
      alt={PRODUTO.nome}
      className={cn('w-auto', variante === 'marca' ? 'h-9' : 'h-8', className)}
    />
  )
}
