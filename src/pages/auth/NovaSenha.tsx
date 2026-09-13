import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

/**
 * Destino do link de recuperação: o clique no e-mail abre o app com uma
 * sessão temporária (evento PASSWORD_RECOVERY, tratado no App), e esta tela
 * grava a senha nova.
 */
export default function NovaSenha() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmacao) {
      toast.error('As senhas não conferem.')
      return
    }
    if (senha.length < 8) {
      toast.error('Use uma senha com pelo menos 8 caracteres.')
      return
    }

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)

    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`)
      return
    }
    toast.success('Senha atualizada.')
    navigate('/painel')
  }

  return (
    <AuthLayout titulo="Definir nova senha">
      <form onSubmit={salvar} className="space-y-4">
        <Campo label="Nova senha" htmlFor="senha" hint="Pelo menos 8 caracteres">
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Campo label="Confirmar nova senha" htmlFor="confirmacao">
          <Input
            id="confirmacao"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </Campo>
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}
