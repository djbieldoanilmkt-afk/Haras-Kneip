/**
 * Porte tipado de js/store.js.
 *
 * IMPORTANTE: os nomes de coluna aqui seguem o schema REAL do banco, não os
 * nomes que o app legado usava. O legado gravava em cinco colunas inexistentes
 * (reproducao.tipo_evento, reproducao.parceiro_nome, reproducao.previsao_parto,
 * anotacoes.texto e anotacoes.autor), o que fazia essas duas telas falharem.
 * Ver src/lib/database.types.ts.
 */

import { supabase } from './supabase'
import { paraCentavos, paraReais, ratearCentavos } from './dinheiro'
import type {
  Animal,
  AnimalResumo,
  Anotacao,
  Configuracao,
  Despesa,
  Evento,
  Genealogia,
  GenealogiaResumo,
  Haras,
  Membro,
  Pesagem,
  Reproducao,
  SaudeRegistro,
  TabelaReversivel,
} from './database.types'

export type AnimalFilters = {
  sexo?: string
  status_reprodutivo?: string
  em_destaque?: boolean
  search?: string
  orderBy?: string
  ascending?: boolean
}

export type Stats = {
  totalAnimais: number
  femeas: number
  machos: number
  prenhas: number
  lactantes: number
  eventosProximos: Evento[]
}

export type SaudeRegistroComAnimal = SaudeRegistro & { animal: string }
export type ReproducaoComAnimal = Reproducao & { matriz: string }

/** Vacina, vermífugo ou exame com data de retorno marcada e já no radar. */
export type PendenciaSanitaria = {
  id: string
  animal_id: string
  animal: string
  tipo: string
  descricao: string
  proxima_data: string
}

export type PartoPrevisto = {
  id: string
  animal_id: string
  matriz: string
  garanhao: string | null
  data_prevista_parto: string
}

export type PesagemResumo = {
  animal_id: string
  animal: string
  peso: number
  data_pesagem: string
  /** Diferença em kg contra a pesagem anterior; null quando é a primeira. */
  variacao: number | null
}

export type CustoPorMes = { mes: string; total: number }
export type CustoPorAnimal = { animal_id: string; animal: string; total: number }
export type CustoPorCategoria = { categoria: string; total: number }

export type RateioResumo = { animal_id: string; animal: string; valor: number }

export type DespesaComRateio = Despesa & { rateios: RateioResumo[] }

/** Campos que a tela preenche; o resto vem de default ou trigger. */
export type NovaDespesa = {
  data: string
  categoria: string
  descricao: string
  valor: number
  fornecedor?: string | null
  observacoes?: string | null
}

export type ResumoCustos = {
  mesAtual: number
  mesAnterior: number
  porMes: CustoPorMes[]
  porAnimal: CustoPorAnimal[]
  porCategoria: CustoPorCategoria[]
}

/**
 * O PostgREST devolve o vínculo "muitos para um" como objeto, mas o cliente
 * tipa a coluna embutida de forma ampla porque este projeto não usa tipos
 * gerados. Este é o formato real que chega.
 */
type ComAnimal = { animais: { nome: string } | null }

/** Código do PostgREST para "nenhuma linha encontrada" em consulta .single(). */
const NAO_ENCONTRADO = 'PGRST116'

/**
 * Data no calendário LOCAL, em "AAAA-MM-DD".
 *
 * `toISOString()` converte para UTC antes de cortar a string. Em fuso
 * negativo — o Brasil inteiro — a partir do fim da tarde isso devolve o dia
 * seguinte, e a agenda passaria a pular o dia corrente. É o mesmo motivo pelo
 * qual format.ts decompõe a string em vez de usar `new Date()`.
 */
function paraISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function hoje(): string {
  return paraISO(new Date())
}

/** Aceita deslocamento negativo. `setDate` vira mês e ano sozinho. */
function emDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

/** Primeiro dia do mês, deslocado em meses (negativo = passado). */
function inicioDoMes(deslocamento = 0): string {
  const agora = new Date()
  return paraISO(new Date(agora.getFullYear(), agora.getMonth() + deslocamento, 1))
}

/** Chave "AAAA-MM" usada para agrupar por mês. */
export function chaveMes(data: string): string {
  return data.slice(0, 7)
}

export const store = {
  // ---------------------------------------------------------------- animais

  async getAnimais(filters: AnimalFilters = {}): Promise<Animal[]> {
    let query = supabase.from('animais').select('*').eq('ativo', true)

    if (filters.sexo) query = query.eq('sexo', filters.sexo)
    if (filters.status_reprodutivo) {
      query = query.eq('status_reprodutivo', filters.status_reprodutivo)
    }
    if (filters.em_destaque !== undefined) query = query.eq('em_destaque', filters.em_destaque)
    if (filters.search) query = query.ilike('nome', `%${filters.search}%`)

    query = filters.orderBy
      ? query.order(filters.orderBy, { ascending: filters.ascending ?? true })
      : query.order('nome')

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Animal[]
  },

  async getAnimal(id: string): Promise<Animal> {
    const { data, error } = await supabase.from('animais').select('*').eq('id', id).single()
    if (error) throw error
    return data as Animal
  },

  async createAnimal(data: Partial<Animal>): Promise<Animal> {
    const { data: result, error } = await supabase.from('animais').insert([data]).select()
    if (error) throw error
    return (result as Animal[])[0]
  },

  async updateAnimal(id: string, data: Partial<Animal>): Promise<Animal> {
    const { data: result, error } = await supabase
      .from('animais')
      .update(data)
      .eq('id', id)
      .select()
    if (error) throw error
    return (result as Animal[])[0]
  },

  async deleteAnimal(id: string): Promise<void> {
    const { error } = await supabase.from('animais').update({ ativo: false }).eq('id', id)
    if (error) throw error
  },

  async toggleDestaque(id: string, em_destaque: boolean): Promise<Animal> {
    const { data, error } = await supabase
      .from('animais')
      .update({ em_destaque })
      .eq('id', id)
      .select()
    if (error) throw error
    return (data as Animal[])[0]
  },

  async toggleAllDestaque(em_destaque: boolean): Promise<Animal[]> {
    const { data, error } = await supabase
      .from('animais')
      .update({ em_destaque })
      .eq('ativo', true)
      .select()
    if (error) throw error
    return (data ?? []) as Animal[]
  },

  // --------------------------------------------------------------- vitrine

  /** Haras pelo slug da URL pública. Null quando não existe ou está bloqueado. */
  async getHarasPorSlug(slug: string): Promise<Haras | null> {
    const { data, error } = await supabase
      .from('haras')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return (data as Haras | null) ?? null
  },

  /**
   * Animais em destaque de UM haras. O RLS já limita a contas ativas, mas o
   * filtro explícito é o que impede a vitrine de um haras exibir animais de
   * outro assim que existir mais de um tenant.
   */
  async getVitrine(harasId: string): Promise<{
    animais: Animal[]
    genealogias: GenealogiaResumo[]
  }> {
    const [animais, genealogias] = await Promise.all([
      supabase
        .from('animais')
        .select('*')
        .eq('haras_id', harasId)
        .eq('em_destaque', true)
        .eq('ativo', true)
        .order('nome'),
      supabase.from('genealogia').select('animal_id, pai_id, mae_id').eq('haras_id', harasId),
    ])

    if (animais.error) throw animais.error
    if (genealogias.error) throw genealogias.error

    return {
      animais: (animais.data ?? []) as Animal[],
      genealogias: (genealogias.data ?? []) as GenealogiaResumo[],
    }
  },

  async getAnimaisMap(): Promise<Record<string, AnimalResumo>> {
    const animais = await this.getAnimais()
    const mapa: Record<string, AnimalResumo> = {}
    for (const a of animais) {
      mapa[a.id] = { nome: a.nome, foto_url: a.foto_url }
    }
    return mapa
  },

  // ------------------------------------------------------------ genealogia

  async getGenealogia(animalId: string): Promise<Genealogia | null> {
    const { data, error } = await supabase
      .from('genealogia')
      .select('*')
      .eq('animal_id', animalId)
      .single()

    if (error && (error as { code?: string }).code !== NAO_ENCONTRADO) throw error
    return (data as Genealogia | null) ?? null
  },

  async saveGenealogia(data: Partial<Genealogia>): Promise<Genealogia> {
    const { data: result, error } = await supabase.from('genealogia').upsert(data).select()
    if (error) throw error
    return (result as Genealogia[])[0]
  },

  async getAllGenealogias(): Promise<GenealogiaResumo[]> {
    const { data, error } = await supabase.from('genealogia').select('animal_id, pai_id, mae_id')
    if (error) throw error
    return (data ?? []) as GenealogiaResumo[]
  },

  // ----------------------------------------------------------------- saude

  async getSaudeRegistros(animalId: string): Promise<SaudeRegistro[]> {
    const { data, error } = await supabase
      .from('saude_registros')
      .select('*')
      .eq('animal_id', animalId)
      .order('data_registro', { ascending: false })
    if (error) throw error
    return (data ?? []) as SaudeRegistro[]
  },

  async createSaudeRegistro(data: Partial<SaudeRegistro>): Promise<SaudeRegistro> {
    const { data: result, error } = await supabase.from('saude_registros').insert([data]).select()
    if (error) throw error
    return (result as SaudeRegistro[])[0]
  },

  // ------------------------------------------------------------ reproducao

  async getReproducao(animalId: string): Promise<Reproducao[]> {
    const { data, error } = await supabase
      .from('reproducao')
      .select('*')
      .eq('animal_id', animalId)
      .order('data_evento', { ascending: false })
    if (error) throw error
    return (data ?? []) as Reproducao[]
  },

  async createReproducao(data: Partial<Reproducao>): Promise<Reproducao> {
    const { data: result, error } = await supabase.from('reproducao').insert([data]).select()
    if (error) throw error
    return (result as Reproducao[])[0]
  },

  // ------------------------------------------------------------- anotacoes

  async getAnotacoes(animalId: string): Promise<Anotacao[]> {
    const { data, error } = await supabase
      .from('anotacoes')
      .select('*')
      .eq('animal_id', animalId)
      .order('data_registro', { ascending: false })
    if (error) throw error
    return (data ?? []) as Anotacao[]
  },

  async createAnotacao(data: Partial<Anotacao>): Promise<Anotacao> {
    const { data: result, error } = await supabase.from('anotacoes').insert([data]).select()
    if (error) throw error
    return (result as Anotacao[])[0]
  },

  // --------------------------------------------------------------- eventos

  async getEventos(month?: number, year?: number): Promise<Evento[]> {
    let query = supabase.from('eventos').select('*')

    if (month && year) {
      const inicio = `${year}-${String(month).padStart(2, '0')}-01`
      const ultimoDia = new Date(year, month, 0).getDate()
      const fim = `${year}-${String(month).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
      query = query.gte('data_evento', inicio).lte('data_evento', fim)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Evento[]
  },

  async createEvento(data: Partial<Evento>): Promise<Evento> {
    const { data: result, error } = await supabase.from('eventos').insert([data]).select()
    if (error) throw error
    return (result as Evento[])[0]
  },

  async updateEvento(id: string, data: Partial<Evento>): Promise<Evento> {
    const { data: result, error } = await supabase
      .from('eventos')
      .update(data)
      .eq('id', id)
      .select()
    if (error) throw error
    return (result as Evento[])[0]
  },

  // -------------------------------------------------------------- pesagens

  async getPesagens(animalId: string): Promise<Pesagem[]> {
    const { data, error } = await supabase
      .from('pesagens')
      .select('*')
      .eq('animal_id', animalId)
      .order('data_pesagem', { ascending: true })
    if (error) throw error
    return (data ?? []) as Pesagem[]
  },

  async createPesagem(data: Partial<Pesagem>): Promise<Pesagem> {
    const { data: result, error } = await supabase.from('pesagens').insert([data]).select()
    if (error) throw error
    return (result as Pesagem[])[0]
  },

  // ----------------------------------------------------------------- stats

  async getStats(): Promise<Stats> {
    const animais = await this.getAnimais()

    const { data: eventosProximos, error } = await supabase
      .from('eventos')
      .select('*')
      .gte('data_evento', hoje())
      .lte('data_evento', emDias(7))
      .eq('concluido', false)

    if (error) throw error

    return {
      totalAnimais: animais.length,
      femeas: animais.filter((a) => a.sexo === 'Fêmea').length,
      machos: animais.filter((a) => a.sexo === 'Macho').length,
      prenhas: animais.filter((a) => a.status_reprodutivo === 'Prenha').length,
      lactantes: animais.filter((a) => a.status_reprodutivo === 'Lactante').length,
      eventosProximos: (eventosProximos ?? []) as Evento[],
    }
  },

  // ------------------------------------------- visões de haras inteiro
  //
  // getSaudeRegistros e getReproducao recebem um animal e servem ao perfil.
  // Estas duas atendem as telas de Sanidade e Reprodução, que olham o plantel
  // todo de uma vez.

  async getSaudeRegistrosPlantel(meses = 12): Promise<SaudeRegistroComAnimal[]> {
    const { data, error } = await supabase
      .from('saude_registros')
      .select('*, animais(nome)')
      .gte('data_registro', inicioDoMes(-(meses - 1)))
      .order('data_registro', { ascending: false })

    if (error) throw error

    return (data ?? []).map((linha) => {
      const r = linha as unknown as SaudeRegistro & ComAnimal
      return { ...r, animal: r.animais?.nome ?? 'Animal removido' }
    })
  },

  async getReproducaoPlantel(meses = 12): Promise<ReproducaoComAnimal[]> {
    const { data, error } = await supabase
      .from('reproducao')
      // Duas chaves apontam para `animais` (a matriz e a cria); ver
      // getPartosPrevistos.
      .select('*, animais!reproducao_animal_id_fkey(nome)')
      .gte('data_evento', inicioDoMes(-(meses - 1)))
      .order('data_evento', { ascending: false })

    if (error) throw error

    return (data ?? []).map((linha) => {
      const r = linha as unknown as Reproducao & ComAnimal
      return { ...r, matriz: r.animais?.nome ?? 'Animal removido' }
    })
  },

  // ------------------------------------------------------------- pendências

  /**
   * Sanidade com retorno marcado: o que já venceu e o que vence dentro da
   * janela. Não há limite para trás de propósito — vacina atrasada há três
   * meses continua sendo pendência; ela não deixa de ser problema por ser
   * antiga.
   */
  async getPendenciasSanitarias(janelaDias = 30): Promise<PendenciaSanitaria[]> {
    const { data, error } = await supabase
      .from('saude_registros')
      .select('id, animal_id, tipo, descricao, proxima_data, animais(nome)')
      .not('proxima_data', 'is', null)
      .lte('proxima_data', emDias(janelaDias))
      .order('proxima_data', { ascending: true })

    if (error) throw error

    return (data ?? []).map((linha) => {
      const r = linha as unknown as SaudeRegistro & ComAnimal
      return {
        id: r.id,
        animal_id: r.animal_id,
        animal: r.animais?.nome ?? 'Animal removido',
        tipo: r.tipo,
        descricao: r.descricao,
        proxima_data: r.proxima_data as string,
      }
    })
  },

  /**
   * Partos previstos. `cria_id` preenchido quer dizer que o potro já nasceu e
   * foi cadastrado, então a previsão sai da lista.
   *
   * A janela para trás é intencional: égua que passou da data prevista é
   * justamente o caso que mais precisa de atenção, e sumir do painel seria o
   * comportamento errado.
   */
  async getPartosPrevistos(janelaDias = 90): Promise<PartoPrevisto[]> {
    const { data, error } = await supabase
      .from('reproducao')
      // Duas chaves desta tabela apontam para `animais` (a matriz e a cria).
      // Sem nomear a constraint o PostgREST não sabe qual seguir e recusa.
      .select(
        'id, animal_id, garanhao, data_prevista_parto, animais!reproducao_animal_id_fkey(nome)',
      )
      .not('data_prevista_parto', 'is', null)
      .is('cria_id', null)
      .gte('data_prevista_parto', emDias(-30))
      .lte('data_prevista_parto', emDias(janelaDias))
      .order('data_prevista_parto', { ascending: true })

    if (error) throw error

    return (data ?? []).map((linha) => {
      const r = linha as unknown as Reproducao & ComAnimal
      return {
        id: r.id,
        animal_id: r.animal_id,
        matriz: r.animais?.nome ?? 'Animal removido',
        garanhao: r.garanhao,
        data_prevista_parto: r.data_prevista_parto as string,
      }
    })
  },

  // ---------------------------------------------------------------- custos

  /**
   * Custo do haras por mês, por animal e por categoria.
   *
   * Duas fontes somam aqui: o `custo` dos registros de sanidade (o que passa
   * pelo veterinário) e a tabela `despesas` (ração, ferrageamento, mão de
   * obra, transporte).
   *
   * No total do mês entra o valor da despesa, e não a soma dos rateios dela.
   * Os dois números são iguais quando há rateio, mas despesa sem rateio — um
   * gasto do haras que não se atribui a nenhum animal — precisa contar no mês
   * mesmo assim. Ela aparece no mês e, corretamente, não aparece no custo por
   * animal.
   */
  async getResumoCustos(meses = 6): Promise<ResumoCustos> {
    const desde = inicioDoMes(-(meses - 1))

    const [sanidade, despesas] = await Promise.all([
      supabase
        .from('saude_registros')
        .select('custo, data_registro, animal_id, animais(nome)')
        .not('custo', 'is', null)
        .gte('data_registro', desde),
      // Uma consulta só: a despesa traz os próprios rateios embutidos, então
      // o total do mês e o custo por animal saem da mesma ida ao banco.
      supabase
        .from('despesas')
        .select('valor, data, categoria, despesa_rateios(animal_id, valor, animais(nome))')
        .gte('data', desde),
    ])

    if (sanidade.error) throw sanidade.error
    if (despesas.error) throw despesas.error

    // Semeia todos os meses da janela com zero: mês sem gasto precisa aparecer
    // como zero, senão o gráfico pula o período e sugere um gasto contínuo que
    // não houve.
    const porMesMapa = new Map<string, number>()
    for (let i = meses - 1; i >= 0; i--) porMesMapa.set(chaveMes(inicioDoMes(-i)), 0)

    const porAnimalMapa = new Map<string, CustoPorAnimal>()
    const porCategoriaMapa = new Map<string, number>()

    const somaMes = (data: string, valor: number) => {
      const mes = chaveMes(data)
      if (porMesMapa.has(mes)) porMesMapa.set(mes, (porMesMapa.get(mes) ?? 0) + valor)
    }

    const somaAnimal = (animalId: string, nome: string | undefined, valor: number) => {
      const acumulado = porAnimalMapa.get(animalId)
      if (acumulado) {
        acumulado.total += valor
      } else {
        porAnimalMapa.set(animalId, {
          animal_id: animalId,
          animal: nome ?? 'Animal removido',
          total: valor,
        })
      }
    }

    for (const linha of sanidade.data ?? []) {
      const r = linha as unknown as SaudeRegistro & ComAnimal
      const valor = Number(r.custo ?? 0)
      somaMes(r.data_registro, valor)
      somaAnimal(r.animal_id, r.animais?.nome, valor)
      porCategoriaMapa.set('Veterinário', (porCategoriaMapa.get('Veterinário') ?? 0) + valor)
    }

    for (const linha of despesas.data ?? []) {
      const d = linha as unknown as {
        valor: number
        data: string
        categoria: string
        despesa_rateios: ({ animal_id: string; valor: number } & ComAnimal)[] | null
      }
      const valor = Number(d.valor ?? 0)

      somaMes(d.data, valor)
      porCategoriaMapa.set(d.categoria, (porCategoriaMapa.get(d.categoria) ?? 0) + valor)

      for (const rateio of d.despesa_rateios ?? []) {
        somaAnimal(rateio.animal_id, rateio.animais?.nome, Number(rateio.valor ?? 0))
      }
    }

    return {
      mesAtual: porMesMapa.get(chaveMes(inicioDoMes(0))) ?? 0,
      mesAnterior: porMesMapa.get(chaveMes(inicioDoMes(-1))) ?? 0,
      porMes: [...porMesMapa].map(([mes, total]) => ({ mes, total })),
      porAnimal: [...porAnimalMapa.values()].sort((a, b) => b.total - a.total),
      porCategoria: [...porCategoriaMapa]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total),
    }
  },

  // -------------------------------------------------------------- pesagens

  /**
   * Última pesagem de cada animal, com a variação contra a anterior.
   *
   * Vem da mais antiga para a mais recente porque quem olha esta lista está
   * atrás de quem está há tempo demais sem passar na balança — esse é o
   * primeiro nome que precisa aparecer.
   */
  async getPesagensResumo(): Promise<PesagemResumo[]> {
    const { data, error } = await supabase
      .from('pesagens')
      .select('animal_id, peso, data_pesagem, animais(nome)')
      .order('data_pesagem', { ascending: false })

    if (error) throw error

    // A consulta vem da mais recente para a mais antiga, então a primeira
    // linha de cada animal é a pesagem atual e a segunda é a anterior. As
    // demais não interessam aqui.
    const atual = new Map<string, PesagemResumo>()
    const jaComparado = new Set<string>()

    for (const linha of data ?? []) {
      const p = linha as unknown as Pesagem & ComAnimal
      const registro = atual.get(p.animal_id)

      if (!registro) {
        atual.set(p.animal_id, {
          animal_id: p.animal_id,
          animal: p.animais?.nome ?? 'Animal removido',
          peso: Number(p.peso),
          data_pesagem: p.data_pesagem,
          variacao: null,
        })
      } else if (!jaComparado.has(p.animal_id)) {
        registro.variacao = registro.peso - Number(p.peso)
        jaComparado.add(p.animal_id)
      }
    }

    return [...atual.values()].sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem))
  },

  // -------------------------------------------------------------- despesas

  async getDespesas(meses = 6): Promise<DespesaComRateio[]> {
    const { data, error } = await supabase
      .from('despesas')
      .select('*, despesa_rateios(animal_id, valor, animais(nome))')
      .gte('data', inicioDoMes(-(meses - 1)))
      .order('data', { ascending: false })

    if (error) throw error

    return (data ?? []).map((linha) => {
      const d = linha as unknown as Despesa & {
        despesa_rateios: ({ animal_id: string; valor: number } & ComAnimal)[] | null
      }
      return {
        ...d,
        rateios: (d.despesa_rateios ?? []).map((r) => ({
          animal_id: r.animal_id,
          animal: r.animais?.nome ?? 'Animal removido',
          valor: Number(r.valor ?? 0),
        })),
      }
    })
  },

  /**
   * Grava a despesa e, se houver animais escolhidos, o rateio em partes que
   * somam exatamente o valor.
   *
   * Não é uma transação: o PostgREST não abre uma que abranja duas tabelas.
   * Por isso, se o rateio falhar, a despesa recém-criada é apagada. Deixá-la
   * viva seria pior do que o erro — ela contaria no total do mês e sumiria do
   * custo por animal, e quem lançou acharia que atribuiu. O jeito definitivo
   * é mover as duas escritas para uma função no banco.
   */
  async createDespesa(dados: NovaDespesa, animaisIds: string[] = []): Promise<Despesa> {
    const { data, error } = await supabase.from('despesas').insert([dados]).select().single()
    if (error) throw error

    const criada = data as Despesa
    if (animaisIds.length === 0) return criada

    const partes = ratearCentavos(paraCentavos(dados.valor), animaisIds.length)
    const linhas = animaisIds.map((animal_id, i) => ({
      despesa_id: criada.id,
      animal_id,
      valor: paraReais(partes[i]),
    }))

    const { error: erroRateio } = await supabase.from('despesa_rateios').insert(linhas)
    if (erroRateio) {
      await supabase.from('despesas').delete().eq('id', criada.id)
      throw erroRateio
    }

    return criada
  },

  // -------------------------------------------------- exclusão reversível

  /**
   * Exclusão lógica. Some da tela na hora e continua no banco, para o
   * "desfazer" logo em seguida.
   *
   * Vai por função no banco, e não por UPDATE direto, porque o PostgreSQL
   * aplica as políticas de SELECT à linha resultante de um UPDATE: com
   * `excluido_em is null` na política, esconder a própria linha é recusado
   * como violação de RLS. Ver o comentário em 006_fundacao_agente.sql.
   */
  async excluirRegistro(tabela: TabelaReversivel, id: string): Promise<void> {
    const { error } = await supabase.rpc('excluir_registro', {
      p_tabela: tabela,
      p_id: id,
    })
    if (error) throw error
  },

  async restaurarRegistro(tabela: TabelaReversivel, id: string): Promise<void> {
    const { error } = await supabase.rpc('restaurar_registro', {
      p_tabela: tabela,
      p_id: id,
    })
    if (error) throw error
  },

  // ------------------------------------------------------------ membro

  async getMeuMembro(): Promise<Membro | null> {
    const { data, error } = await supabase.from('membros').select('*').single()
    if (error) {
      if (error.code === NAO_ENCONTRADO) return null
      throw error
    }
    return data as Membro
  },

  /**
   * Grava o telefone já normalizado. O índice único é sobre o valor gravado,
   * então dois formatos do mesmo número passariam batido se cada tela
   * gravasse do seu jeito — a normalização precisa acontecer num lugar só.
   */
  async salvarTelefone(telefone: string | null): Promise<void> {
    const { data: sessao } = await supabase.auth.getUser()
    const userId = sessao.user?.id
    if (!userId) throw new Error('Sessão expirada.')

    const { error } = await supabase
      .from('membros')
      .update({ telefone })
      .eq('user_id', userId)

    if (error) {
      // 23505 = índice único. A mensagem crua do Postgres cita o nome do
      // índice, que não diz nada a quem está preenchendo o campo.
      if ((error as { code?: string }).code === '23505') {
        throw new Error('Este telefone já está cadastrado em outra conta.')
      }
      throw error
    }
  },

  // -------------------------------------------------------- configuracoes

  async getConfiguracoes(): Promise<Configuracao[]> {
    const { data, error } = await supabase.from('configuracoes').select('*')
    if (error) throw error
    return (data ?? []) as Configuracao[]
  },

  async saveConfiguracao(chave: string, valor: string): Promise<void> {
    // onConflict explicito: a unicidade agora e (haras_id, chave), nao (chave).
    // Sem isto o upsert nao encontra a linha existente e falha por duplicidade.
    const harasId = await this.meuHarasId()
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ haras_id: harasId, chave, valor }, { onConflict: 'haras_id,chave' })
    if (error) throw error
  },

  /** Haras da sessão atual, resolvido pelo vínculo em `membros`. */
  async meuHarasId(): Promise<string> {
    const { data, error } = await supabase.from('membros').select('haras_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Sua conta não está vinculada a nenhum haras.')
    return (data as { haras_id: string }).haras_id
  },

  // ---------------------------------------------------------------- export

  async exportData(): Promise<string> {
    const tabelas = [
      'animais',
      'genealogia',
      'saude_registros',
      'reproducao',
      'anotacoes',
      'eventos',
      'pesagens',
      'configuracoes',
    ] as const

    const conteudo: Record<string, unknown> = {}
    for (const tabela of tabelas) {
      const { data, error } = await supabase.from(tabela).select('*')
      if (error) throw error
      conteudo[tabela] = data ?? []
    }
    conteudo.exported_at = new Date().toISOString()

    return JSON.stringify(conteudo, null, 2)
  },
}
