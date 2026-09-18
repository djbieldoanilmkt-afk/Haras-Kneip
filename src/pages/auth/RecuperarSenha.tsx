import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function recuperar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    })
    setEnviando(false)

    if (error) {
      toast.error(`Não foi possível enviar: ${error.message}`)
      return
    }
    setEnviado(true)
  }

  return (
    <AuthLayout
      titulo="Recuperar senha"
      rodape={
        <Link to="/entrar" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <p className="text-sm">
          Se existir conta para <strong>{email}</strong>, um link de redefinição chega em
          instantes. Abra pelo mesmo navegador.
        </p>
      ) : (
        <form onSubmit={recuperar} className="space-y-4">
          <Campo label="E-mail da conta" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link de redefinição'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
