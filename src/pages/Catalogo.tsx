import { useMemo, useState } from 'react'
import { Copy, ListChecks, MessageCircle, Search, Star, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { AnimalCard } from '@/components/AnimalCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import type { Animal } from '@/lib/database.types'
import { cn } from '@/lib/utils'

type Filtro = 'Fêmea' | 'Macho' | 'Prenha' | 'destaque'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'Fêmea', label: 'Éguas' },
  { key: 'Macho', label: 'Garanhões' },
  { key: 'Prenha', label: 'Prenhas' },
  { key: 'destaque', label: 'No link' },
]

/** Compara sem acento e sem caixa: "faisca" acha "Faísca". */
function semAcento(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Mesma montagem de js/pages/catalog.js:198. */
const URL_PUBLICA = `${window.location.origin}${window.location.pathname}#/plantel`

export default function Catalogo() {
  const { data, loading, error } = useAsync(
    () => Promise.all([store.getAnimais(), store.getAllGenealogias()]),
    [],
  )

  const [busca, setBusca] = useState('')
  const [ativos, setAtivos] = useState<Set<Filtro>>(new Set())
  const [destaqueLocal, setDestaqueLocal] = useState<Record<string, boolean>>({})

  const animais = useMemo(() => data?.[0] ?? [], [data])
  const genealogias = useMemo(() => data?.[1] ?? [], [data])

  const linhagemPorAnimal = useMemo(() => {
    const nomes = new Map(animais.map((a) => [a.id, a.nome]))
    const mapa: Record<string, { pai_nome: string | null; mae_nome: string | null }> = {}
    for (const g of genealogias) {
      mapa[g.animal_id] = {
        pai_nome: g.pai_id ? (nomes.get(g.pai_id) ?? null) : null,
        mae_nome: g.mae_id ? (nomes.get(g.mae_id) ?? null) : null,
      }
    }
    return mapa
  }, [animais, genealogias])

  const emDestaque = (a: Animal) => destaqueLocal[a.id] ?? a.em_destaque !== false

  /*
    Busca e filtro se somam, em vez de um anular o outro.

    Procurar "estrela" dentro de "Éguas" tem de devolver as éguas chamadas
    Estrela — nao todas as Estrelas nem todas as éguas. Sao perguntas
    diferentes sobre o mesmo plantel.

    Comparacao sem acento: quem digita no celular, no curral, escreve "faisca"
    e precisa achar "Faísca". Exigir o acento certo e transformar a busca num
    teste de digitacao.
  */
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim())

    const passaNoFiltro = (a: Animal) =>
      ativos.size === 0 ||
      (ativos.has('Fêmea') && a.sexo === 'Fêmea') ||
      (ativos.has('Macho') && a.sexo === 'Macho') ||
      (ativos.has('Prenha') && a.status_reprodutivo === 'Prenha') ||
      (ativos.has('destaque') && emDestaque(a))

    const passaNaBusca = (a: Animal) =>
      termo === '' ||
      semAcento(a.nome).includes(termo) ||
      semAcento(a.apelido ?? '').includes(termo) ||
      semAcento(a.registro_abccmm ?? '').includes(termo) ||
      semAcento(a.baia_piquete ?? '').includes(termo)

    return animais.filter((a) => passaNoFiltro(a) && passaNaBusca(a))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animais, ativos, destaqueLocal, busca])

  const totalNoLink = animais.filter(emDestaque).length

  function alternarFiltro(filtro: Filtro) {
    setAtivos((anterior) => {
      const proximo = new Set(anterior)
      if (proximo.has(filtro)) proximo.delete(filtro)
      else proximo.add(filtro)
      return proximo
    })
  }

  /** Atualização otimista: o botão muda na hora, e reverte se o servidor recusar. */
  async function alternarDestaque(a: Animal) {
    const novo = !emDestaque(a)
    setDestaqueLocal((anterior) => ({ ...anterior, [a.id]: novo }))
    try {
      await store.toggleDestaque(a.id, novo)
      toast.success(novo ? 'Animal adicionado ao link.' : 'Animal removido do link.')
    } catch {
      setDestaqueLocal((anterior) => ({ ...anterior, [a.id]: !novo }))
      toast.error('Não foi possível atualizar o link.')
    }
  }

  async function alternarTodos(valor: boolean) {
    const anterior = destaqueLocal
    setDestaqueLocal(Object.fromEntries(animais.map((a) => [a.id, valor])))
    try {
      await store.toggleAllDestaque(valor)
      toast.success(valor ? 'Todos incluídos no link.' : 'Todos removidos do link.')
    } catch {
      setDestaqueLocal(anterior)
      toast.error('Não foi possível atualizar o link.')
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(URL_PUBLICA)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente: ' + URL_PUBLICA)
    }
  }

  function enviarWhatsApp() {
    const mensagem = encodeURIComponent(
      `Olá! Confira a seleção de equinos Mangalarga Marchador do Haras Kneip:\n${URL_PUBLICA}`,
    )
    window.open(`https://wa.me/?text=${mensagem}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <PageHeader
        title="Plantel"
        description={
          loading ? 'Carregando...' : `${visiveis.length} de ${animais.length} animais · ${totalNoLink} no link público`
        }
      />

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <p className="text-primary text-sm font-semibold">Link de apresentação do plantel</p>
          <p className="text-muted-foreground text-xs">
            Compartilhe os animais selecionados com outros criadores.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => alternarTodos(true)}>
            <ListChecks className="size-4" />
            Incluir todos
          </Button>
          <Button variant="outline" size="sm" onClick={() => alternarTodos(false)}>
            <XCircle className="size-4" />
            Remover todos
          </Button>
          <Button variant="outline" size="sm" onClick={copiarLink}>
            <Copy className="size-4" />
            Copiar link
          </Button>
          <Button size="sm" onClick={enviarWhatsApp}>
            <MessageCircle className="size-4" />
            Enviar no WhatsApp
          </Button>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, registro ou baia"
            aria-label="Buscar no plantel"
            className="h-9 pl-8"
          />
        </div>

        <Button
          variant={ativos.size === 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAtivos(new Set())}
          aria-pressed={ativos.size === 0}
        >
          Todos
        </Button>
        {FILTROS.map(({ key, label }) => (
          <Button
            key={key}
            variant={ativos.has(key) ? 'default' : 'outline'}
            size="sm"
            onClick={() => alternarFiltro(key)}
            aria-pressed={ativos.has(key)}
          >
            {key === 'destaque' && <Star className="size-3.5" />}
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <h2 className="text-destructive text-base font-semibold">Erro ao carregar o plantel</h2>
          <p className="text-muted-foreground mt-1 text-sm">{error.message}</p>
        </Card>
      ) : visiveis.length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="text-base font-semibold">Nenhum cavalo encontrado</h2>
          {/*
            Repetir o termo buscado evita o beco sem saída: quem digitou errado
            vê o próprio erro, em vez de concluir que o animal não existe.
          */}
          <p className="text-muted-foreground mt-1 text-sm">
            {busca.trim()
              ? `Nada com "${busca.trim()}". Confira a grafia ou limpe a busca.`
              : 'Tente ajustar os filtros ou cadastrar um novo animal.'}
          </p>
          {busca.trim() && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setBusca('')}>
              Limpar busca
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((a, i) => (
            /*
              A key fica aqui, no wrapper. Como ela e o id do animal, alternar
              o destaque mantem o mesmo no do DOM e a animacao nao reinicia —
              sem isso a grade inteira re-animaria a cada clique.

              Teto de 12: com 30ms por card e 50 animais, o ultimo apareceria
              1,5s depois do primeiro.
            */
            <div
              key={a.id}
              className="animar-entrada"
              style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
            >
            <AnimalCard
              animal={a}
              linhagem={linhagemPorAnimal[a.id]}
              footer={
                <div className="border-border flex items-center justify-between border-t border-dashed px-3 py-2">
                  <span className="text-muted-foreground text-[11px]">Exibir no link</span>
                  <Button
                    size="sm"
                    variant={emDestaque(a) ? 'default' : 'outline'}
                    className={cn('h-6 rounded-full px-2.5 text-[11px]')}
                    onClick={() => alternarDestaque(a)}
                  >
                    {emDestaque(a) ? 'Incluído' : 'Incluir'}
                  </Button>
                </div>
              }
            />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
