import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export default function Entrar() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)

    if (error) {
      toast.error(
        error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : error.message.includes('not confirmed')
            ? 'Confirme seu e-mail antes de entrar — enviamos um link no cadastro.'
            : `Não foi possível entrar: ${error.message}`,
      )
      return
    }
    navigate('/painel')
  }

  return (
    <AuthLayout
      titulo="Entrar"
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={entrar} className="space-y-4">
        <Campo label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo label="Senha" htmlFor="senha">
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Button>

        <div className="text-center">
          <Link to="/recuperar-senha" className="text-muted-foreground text-xs hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
