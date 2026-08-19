import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { PRODUTO } from '@/lib/produto'

export default function CriarConta() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aguardandoEmail, setAguardandoEmail] = useState(false)

  async function criar(e: React.FormEvent) {
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
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    setEnviando(false)

    if (error) {
      toast.error(
        error.message.includes('already registered')
          ? 'Este e-mail já tem conta. Use "Entrar".'
          : `Não foi possível criar a conta: ${error.message}`,
      )
      return
    }

    // Com confirmação de e-mail ligada, o signUp devolve usuário sem sessão.
    if (data.session) {
      navigate('/criar-haras')
    } else {
      setAguardandoEmail(true)
    }
  }

  if (aguardandoEmail) {
    return (
      <AuthLayout titulo="Confirme seu e-mail">
        <div className="space-y-3 text-center">
          <MailCheck className="text-primary mx-auto size-10" />
          <p className="text-sm">
            Enviamos um link de confirmação para <strong>{email}</strong>.
          </p>
          <p className="text-muted-foreground text-sm">
            Clique no link e depois volte aqui para entrar. Seu trial de {PRODUTO.trialDias} dias
            começa no primeiro acesso.
          </p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/entrar')}>
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      titulo="Criar conta"
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={criar} className="space-y-4">
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
        <Campo label="Senha" htmlFor="senha" hint="Pelo menos 8 caracteres">
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Campo label="Confirmar senha" htmlFor="confirmacao">
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
          {enviando ? 'Criando...' : `Criar conta — ${PRODUTO.trialDias} dias grátis`}
        </Button>
      </form>
    </AuthLayout>
  )
}
