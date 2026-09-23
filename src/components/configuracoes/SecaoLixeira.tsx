import { Undo2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { formatDate } from '@/lib/format'
import type { TabelaReversivel } from '@/lib/database.types'

/**
 * A lixeira.
 *
 * Existia uma promessa sem lastro: ao apagar por WhatsApp, o agente respondia
 * "dá para restaurar no sistema, em Configurações" — e não havia tela nenhuma.
 * O dado sempre ficou no banco; faltava a porta.
 *
 * Só restaura. Não apaga de vez: a lixeira existe justamente para o caso de
 * alguém ter apagado errado, e um botão "excluir definitivamente" ao lado do
 * "restaurar" é o convite perfeito para o segundo engano.
 */

const ROTULO: Record<TabelaReversivel, string> = {
  saude_registros: 'Sanidade',
  reproducao: 'Reprodução',
  anotacoes: 'Anotação',
  eventos: 'Calendário',
  pesagens: 'Pesagem',
  despesas: 'Despesa',
  receitas: 'Receita',
}

export function SecaoLixeira() {
  const { data, loading, error, reload } = useAsync(() => store.getLixeira(), [])
  const itens = data ?? []

  async function restaurar(tabela: TabelaReversivel, id: string, descricao: string) {
    try {
      await store.restaurarRegistro(tabela, id)
      toast.success(`"${descricao}" restaurado.`)
      reload()
    } catch (e) {
      toast.error(`Não foi possível restaurar: ${e instanceof Error ? e.message : 'erro'}`)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Trash2 className="size-4" />
        Lixeira
      </h2>
      <p className="text-muted-foreground mb-4 text-xs">
        Tudo que foi excluído aqui ou pelo WhatsApp. Nada some de vez — dá para trazer de volta.
      </p>

      {loading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : itens.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nada excluído. 👍
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {itens.map((item) => (
            <li key={`${item.tabela}-${item.id}`} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.descricao}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {ROTULO[item.tabela] ?? item.tabela}
                  {item.quando ? ` · ${formatDate(item.quando)}` : ''}
                  {' · excluído '}
                  {formatDate(item.excluido_em.slice(0, 10))}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                aria-label={`Restaurar ${item.descricao}`}
                onClick={() => restaurar(item.tabela, item.id, item.descricao)}
              >
                <Undo2 className="size-4" />
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
