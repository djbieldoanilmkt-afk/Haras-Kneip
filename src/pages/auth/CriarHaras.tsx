import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { gerarSlug, validarSlug } from '@/lib/slug'
import { PRODUTO } from '@/lib/produto'

export default function CriarHaras() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditado, setSlugEditado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const validacao = slug ? validarSlug(slug) : { valido: false }

  function aoMudarNome(valor: string) {
    setNome(valor)
    if (!slugEditado) setSlug(gerarSlug(valor))
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()

    if (!nome.trim()) {
      toast.error('Informe o nome do haras.')
      return
    }
    const v = validarSlug(slug)
    if (!v.valido) {
      toast.error(v.motivo ?? 'Endereço inválido.')
      return
    }

    setEnviando(true)
    const { error } = await supabase.rpc('criar_haras', { p_nome: nome.trim(), p_slug: slug })
    setEnviando(false)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Haras criado. Bem-vindo!')
    navigate('/painel')
  }

  return (
    <AuthLayout titulo="Crie seu haras">
      <p className="text-muted-foreground mb-4 text-sm">
        Último passo: dê um nome ao seu haras e escolha o endereço da vitrine pública — o link que
        você vai compartilhar com outros criadores. Seu trial de {PRODUTO.trialDias} dias começa
        agora.
      </p>

      <form onSubmit={criar} className="space-y-4">
        <Campo label="Nome do haras" htmlFor="nome">
          <Input
            id="nome"
            required
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value)}
            placeholder="Ex: Haras Santa Fé"
          />
        </Campo>

        <Campo
          label="Endereço da vitrine"
          htmlFor="slug"
          erro={slug && !validacao.valido ? (validacao as { motivo?: string }).motivo : undefined}
          hint={slug && validacao.valido ? `Sua vitrine: .../#/plantel/${slug}` : undefined}
        >
          <Input
            id="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugEditado(true)
              setSlug(e.target.value.toLowerCase())
            }}
            placeholder="haras-santa-fe"
          />
        </Campo>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Criando...' : 'Criar haras e começar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
