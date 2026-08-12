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
import type {
  Animal,
  AnimalResumo,
  Anotacao,
  Configuracao,
  Evento,
  Genealogia,
  GenealogiaResumo,
  Pesagem,
  Reproducao,
  SaudeRegistro,
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

/** Código do PostgREST para "nenhuma linha encontrada" em consulta .single(). */
const NAO_ENCONTRADO = 'PGRST116'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function emDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
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

  // -------------------------------------------------------- configuracoes

  async getConfiguracoes(): Promise<Configuracao[]> {
    const { data, error } = await supabase.from('configuracoes').select('*')
    if (error) throw error
    return (data ?? []) as Configuracao[]
  },

  async saveConfiguracao(chave: string, valor: string): Promise<void> {
    const { error } = await supabase.from('configuracoes').upsert({ chave, valor })
    if (error) throw error
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
