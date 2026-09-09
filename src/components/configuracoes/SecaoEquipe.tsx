import { useState } from 'react'
import { MailPlus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Campo, SelectSimples } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { useTenant } from '@/hooks/tenant'
import { store } from '@/lib/store'
import { PLANOS } from '@/lib/planos'
import { formatarTelefone } from '@/lib/telefone'
import { cn } from '@/lib/utils'

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  gerente: 'Gerente',
  peao: 'Peão',
}

/**
 * O select do sistema usa o próprio texto como valor, então a escolha vira o
 * rótulo e é traduzida de volta aqui — mostrar "peao" cru na tela seria feio e
 * mandar "Peão" para o banco quebraria o check constraint.
 */
const PAPEL_POR_ROTULO: Record<string, 'gerente' | 'peao'> = {
  'Peão': 'peao',
  Gerente: 'gerente',
}
const ROTULOS_CONVITE = Object.keys(PAPEL_POR_ROTULO)

/**
 * Equipe do haras.
 *
 * O limite é por PESSOA, e não por número de telefone. Cada membro tem o seu
 * número, e é isso que faz a autoria dos lançamentos significar alguma coisa:
 * se três pessoas dividissem um login, tudo apareceria como o mesmo autor e a
 * trilha não serviria para nada.
 */
export function SecaoEquipe() {
  const { haras } = useTenant()
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<'gerente' | 'peao'>('peao')
  const [enviando, setEnviando] = useState(false)

  const { data: equipe, loading: carregandoEquipe, reload: recarregarEquipe } = useAsync(
    () => store.getMinhaEquipe(),
    [],
  )
  const { data: convites, loading: carregandoConvites, reload: recarregarConvites } = useAsync(
    () => store.getConvitesPendentes(),
    [],
  )

  const membros = equipe ?? []
  const pendentes = convites ?? []
  const plano = PLANOS.find((p) => p.id === haras.plano)
  const limite = plano?.limiteUsuarios ?? null

  // Convite pendente ocupa vaga — a mesma regra que o banco aplica. Sem
  // contá-lo aqui, a tela deixaria convidar e o servidor recusaria depois.
  const ocupadas = membros.length + pendentes.length
  const cheio = limite !== null && ocupadas >= limite

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    try {
      await store.convidarMembro(email.trim(), papel)
      toast.success(`Convite enviado para ${email.trim()}.`)
      setEmail('')
      recarregarConvites()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível convidar.')
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar(id: string, alvo: string) {
    try {
      await store.cancelarConvite(id)
      toast.success(`Convite para ${alvo} cancelado.`)
      recarregarConvites()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar.')
    }
  }

  async function remover(userId: string, alvo: string) {
    try {
      await store.removerMembro(userId)
      toast.success(`${alvo} saiu da equipe.`)
      recarregarEquipe()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover.')
    }
  }

  return (
    <Card className="mb-4 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4" />
          Equipe
        </h2>
        <span className={cn('text-xs', cheio ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {limite === null ? `${ocupadas} — ilimitado` : `${ocupadas} de ${limite} no plano ${plano?.nome}`}
        </span>
      </div>

      <p className="text-muted-foreground mb-4 text-sm">
        Cada pessoa tem o próprio acesso e o próprio número de WhatsApp. É assim que o sistema sabe
        quem lançou cada registro.
      </p>

      {carregandoEquipe || carregandoConvites ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <>
          <ul className="divide-border mb-4 divide-y">
            {membros.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.email}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {ROTULO_PAPEL[m.papel] ?? m.papel}
                    {m.telefone ? ` · ${formatarTelefone(m.telefone)}` : ' · sem WhatsApp'}
                  </p>
                </div>

                {m.papel !== 'dono' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${m.email}`}
                    onClick={() => remover(m.user_id, m.email)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}

            {pendentes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground truncate text-sm">{c.email}</p>
                  <p className="text-muted-foreground truncate text-xs italic">
                    Convite pendente · {ROTULO_PAPEL[c.papel] ?? c.papel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Cancelar convite para ${c.email}`}
                  onClick={() => cancelar(c.id, c.email)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>

          {cheio ? (
            <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-sm">
              O plano {plano?.nome} vai até {limite} {limite === 1 ? 'usuário' : 'usuários'}. Para
              incluir mais gente, mude de plano.
            </p>
          ) : (
            <form onSubmit={convidar} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <Campo label="E-mail de quem entra" htmlFor="convite-email">
                <Input
                  id="convite-email"
                  type="email"
                  required
                  placeholder="peao@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Campo>

              <Campo label="Papel">
                <SelectSimples
                  value={ROTULO_PAPEL[papel]}
                  onValueChange={(v) => setPapel(PAPEL_POR_ROTULO[v] ?? 'peao')}
                  options={ROTULOS_CONVITE}
                />
              </Campo>

              <div className="flex items-end">
                <Button type="submit" disabled={enviando}>
                  <MailPlus className="size-4" />
                  {enviando ? 'Enviando...' : 'Convidar'}
                </Button>
              </div>
            </form>
          )}

          <p className="text-muted-foreground mt-3 text-xs">
            A pessoa precisa criar a conta com este mesmo e-mail. O convite aparece para ela no
            primeiro acesso.
          </p>
        </>
      )}
    </Card>
  )
}
