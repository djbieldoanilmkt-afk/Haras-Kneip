import { useState } from 'react'
import { BadgeCheck, KeyRound, MailPlus, MessageCircle, Trash2, Users } from 'lucide-react'
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
import { formatarTelefone, normalizarTelefone } from '@/lib/telefone'
import type { MembroEquipe } from '@/lib/database.types'
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
 * Reivindicar o número e gerar o PIN.
 *
 * Digitar o número aqui não dá acesso a nada: ele só passa a valer quando uma
 * mensagem chega DAQUELE aparelho com o PIN certo. É o que permite o dono
 * cadastrar o telefone do peão sem que isso seja uma brecha.
 */
function PainelWhatsApp({
  membro,
  ehMinhaLinha,
  aoMudar,
}: {
  membro: MembroEquipe
  /** Na própria linha usa-se o caminho de menor privilégio. */
  ehMinhaLinha: boolean
  aoMudar: () => void
}) {
  const [telefone, setTelefone] = useState(formatarTelefone(membro.telefone))
  const [salvando, setSalvando] = useState(false)
  const [pin, setPin] = useState('')
  const [gerando, setGerando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const limpo = telefone.trim()
      // Na própria linha qualquer membro salva; na de outra pessoa, só o dono.
      if (ehMinhaLinha) {
        const normalizado = limpo === '' ? null : normalizarTelefone(limpo)
        if (limpo !== '' && !normalizado) {
          toast.error('Telefone inválido. Use DDD + número, como (31) 99999-8888.')
          return
        }
        await store.salvarTelefone(normalizado)
      } else {
        await store.definirTelefoneMembro(membro.user_id, limpo === '' ? null : limpo)
      }
      toast.success('Telefone atualizado.')
      setPin('')
      aoMudar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function gerar() {
    setGerando(true)
    try {
      setPin(await store.gerarPinTelefone(membro.user_id))
      aoMudar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PIN.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="bg-secondary/50 mt-2 rounded-lg p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Campo label="Número do WhatsApp" htmlFor={`tel-${membro.user_id}`}>
            <Input
              id={`tel-${membro.user_id}`}
              inputMode="tel"
              placeholder="(31) 99999-8888"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </Campo>
        </div>

        <Button variant="outline" size="sm" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Salvar número'}
        </Button>

        {membro.telefone && !membro.verificado_em && (
          <Button size="sm" disabled={gerando} onClick={gerar}>
            <KeyRound className="size-4" />
            {gerando ? 'Gerando...' : membro.tem_pin ? 'Gerar novo PIN' : 'Gerar PIN'}
          </Button>
        )}
      </div>

      {pin && (
        <div className="border-primary/30 bg-card mt-3 rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground text-xs">Peça para essa pessoa mandar</p>
          <p className="font-heading text-primary my-1 text-2xl font-extrabold tracking-widest">
            {pin}
          </p>
          <p className="text-muted-foreground text-xs">
            numa mensagem de WhatsApp para o número do assistente, a partir do celular{' '}
            {formatarTelefone(membro.telefone)}. O código vale por 24 horas e só funciona vindo
            desse aparelho.
          </p>
        </div>
      )}

      {membro.verificado_em && (
        <p className="text-muted-foreground mt-2 text-xs">
          Número já verificado. Para trocar, salve outro — a verificação recomeça.
        </p>
      )}
    </div>
  )
}

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
  const { data: eu } = useAsync(() => store.getMeuMembro(), [])

  const souDono = eu?.papel === 'dono'
  const [abertoId, setAbertoId] = useState('')

  /** O telefone é da pessoa: o dono mexe no de todos, cada um mexe no seu. */
  const podeEditarTelefone = (userId: string) => souDono || userId === eu?.user_id

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
        Cada pessoa tem o próprio acesso e o próprio número de WhatsApp — é assim que o sistema sabe
        quem lançou cada registro. Cadastrar o número apenas o reivindica: ele passa a valer quando
        chega uma mensagem daquele celular com o PIN.
      </p>

      {/*
        Esqueleto SÓ na primeira carga.

        `useAsync` volta a `loading` a cada recarga, mas mantém os dados
        anteriores. Trocar a lista pelo esqueleto nessas recargas desmonta o
        painel de WhatsApp e leva junto o estado local dele — foi assim que o
        PIN recém-gerado sumia da tela: era gerado e gravado, e a recarga que
        eu disparava logo em seguida apagava a exibição.
      */}
      {(carregandoEquipe && !equipe) || (carregandoConvites && !convites) ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <>
          <ul className="divide-border mb-4 divide-y">
            {membros.map((m) => (
              <li key={m.user_id} className="py-2.5">
                <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.email}</p>
                  <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                    {ROTULO_PAPEL[m.papel] ?? m.papel}
                    {m.telefone ? ` · ${formatarTelefone(m.telefone)}` : ' · sem WhatsApp'}
                    {m.telefone &&
                      (m.verificado_em ? (
                        <span className="text-primary flex items-center gap-0.5 font-medium">
                          <BadgeCheck className="size-3" />
                          verificado
                        </span>
                      ) : (
                        <span className="text-status-prenha font-medium">· não verificado</span>
                      ))}
                  </p>
                </div>

                {podeEditarTelefone(m.user_id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`WhatsApp de ${m.email}`}
                    onClick={() => setAbertoId(abertoId === m.user_id ? '' : m.user_id)}
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </Button>
                )}

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
                </div>

                {podeEditarTelefone(m.user_id) && abertoId === m.user_id && (
                  <PainelWhatsApp
                    membro={m}
                    ehMinhaLinha={m.user_id === eu?.user_id}
                    aoMudar={recarregarEquipe}
                  />
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

          {!souDono ? (
            <p className="text-muted-foreground text-sm">
              Só o dono da conta inclui ou remove gente.
            </p>
          ) : cheio ? (
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
