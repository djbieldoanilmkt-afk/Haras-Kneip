import { Lock } from 'lucide-react'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { useTenant } from '@/hooks/tenant'
import { supabase } from '@/lib/supabase'
import { PRODUTO } from '@/lib/produto'

/**
 * Bloqueio pós-trial. Sem gateway de pagamento na v1: a assinatura é
 * combinada por contato direto, e a ativação é manual no banco
 * (status_conta -> 'ativa'). Os dados continuam legíveis; só a escrita trava.
 */
export default function Assinar() {
  const { haras } = useTenant()
  const bloqueada = haras.status_conta === 'bloqueada'

  return (
    <AuthLayout titulo={bloqueada ? 'Conta suspensa' : 'Seu período de teste terminou'}>
      <div className="space-y-4">
        <div className="bg-secondary mx-auto flex size-12 items-center justify-center rounded-full">
          <Lock className="text-muted-foreground size-5" />
        </div>

        <p className="text-sm">
          {bloqueada
            ? `A conta do ${haras.nome} está suspensa.`
            : `Os ${PRODUTO.trialDias} dias de teste do ${haras.nome} acabaram. Seus dados estão
               guardados e continuam visíveis — para voltar a registrar, assine o plano.`}
        </p>

        <Button
          className="w-full"
          nativeButton={false}
          render={
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Olá! Quero assinar o ${PRODUTO.nome} para o ${haras.nome}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Falar com a gente e assinar
        </Button>

        <Button variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>
          Sair da conta
        </Button>
      </div>
    </AuthLayout>
  )
}
