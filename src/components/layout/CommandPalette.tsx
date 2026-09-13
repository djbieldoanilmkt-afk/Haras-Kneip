import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'

/**
 * Busca global por animal.
 *
 * Substitui o input do header legado, que disparava um CustomEvent
 * 'globalSearch' escutado só pela página de catálogo — em qualquer outra tela
 * digitar na busca não fazia nada. Aqui a seleção navega direto para o perfil.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { data: animais, loading } = useAsync(() => store.getAnimais(), [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar animal"
      description="Digite o nome de um animal do plantel."
    >
      <CommandInput placeholder="Buscar animal pelo nome..." />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Carregando plantel...' : 'Nenhum animal encontrado.'}
        </CommandEmpty>
        <CommandGroup heading="Plantel">
          {(animais ?? []).map((a) => (
            <CommandItem
              key={a.id}
              value={a.nome}
              onSelect={() => {
                onOpenChange(false)
                navigate(`/animal/${a.id}`)
              }}
            >
              {a.nome}
              <span className="text-muted-foreground ml-auto text-xs">{a.pelagem}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/** Estado da paleta mais o atalho Ctrl+K / Cmd+K. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  return { open, setOpen }
}
