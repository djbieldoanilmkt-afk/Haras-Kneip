import { supabase } from './supabase.js';

export const store = {
  async getAnimais(filters = {}) {
    let query = supabase.from('animais').select('*').eq('ativo', true);
    if (filters.sexo) query = query.eq('sexo', filters.sexo);
    if (filters.status_reprodutivo) query = query.eq('status_reprodutivo', filters.status_reprodutivo);
    if (filters.em_destaque !== undefined) query = query.eq('em_destaque', filters.em_destaque);
    if (filters.search) query = query.ilike('nome', `%${filters.search}%`);
    if (filters.orderBy) query = query.order(filters.orderBy, { ascending: filters.ascending ?? true });
    else query = query.order('nome');
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async toggleDestaque(id, em_destaque) {
    const { data: result, error } = await supabase.from('animais').update({ em_destaque }).eq('id', id).select();
    if (error) throw error;
    return result[0];
  },

  async toggleAllDestaque(em_destaque) {
    const { data: result, error } = await supabase.from('animais').update({ em_destaque }).eq('ativo', true).select();
    if (error) throw error;
    return result;
  },
  
  async getAnimal(id) {
    const { data, error } = await supabase.from('animais').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async createAnimal(data) {
    const { data: result, error } = await supabase.from('animais').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async updateAnimal(id, data) {
    const { data: result, error } = await supabase.from('animais').update(data).eq('id', id).select();
    if (error) throw error;
    return result[0];
  },

  async deleteAnimal(id) {
    const { error } = await supabase.from('animais').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  async getGenealogia(animalId) {
    const { data, error } = await supabase.from('genealogia').select('*').eq('animal_id', animalId).single();
    if (error && error.code !== 'PGRST116') throw error; // ignore not found
    return data;
  },

  async saveGenealogia(data) {
    const { data: result, error } = await supabase.from('genealogia').upsert(data).select();
    if (error) throw error;
    return result[0];
  },

  async getSaudeRegistros(animalId) {
    const { data, error } = await supabase.from('saude_registros').select('*').eq('animal_id', animalId).order('data_registro', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createSaudeRegistro(data) {
    const { data: result, error } = await supabase.from('saude_registros').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async getReproducao(animalId) {
    const { data, error } = await supabase.from('reproducao').select('*').eq('animal_id', animalId).order('data_evento', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createReproducao(data) {
    const { data: result, error } = await supabase.from('reproducao').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async getAnotacoes(animalId) {
    const { data, error } = await supabase.from('anotacoes').select('*').eq('animal_id', animalId).order('data_registro', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createAnotacao(data) {
    const { data: result, error } = await supabase.from('anotacoes').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async getEventos(month, year) {
    // Basic implementation for events fetching
    let query = supabase.from('eventos').select('*');
    if (month && year) {
       const start = new Date(year, month - 1, 1).toISOString();
       const end = new Date(year, month, 0).toISOString();
       query = query.gte('data_evento', start).lte('data_evento', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createEvento(data) {
    const { data: result, error } = await supabase.from('eventos').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async updateEvento(id, data) {
    const { data: result, error } = await supabase.from('eventos').update(data).eq('id', id).select();
    if (error) throw error;
    return result[0];
  },

  async getPesagens(animalId) {
    const { data, error } = await supabase.from('pesagens').select('*').eq('animal_id', animalId).order('data_pesagem', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createPesagem(data) {
    const { data: result, error } = await supabase.from('pesagens').insert([data]).select();
    if (error) throw error;
    return result[0];
  },

  async getStats() {
    const animais = await this.getAnimais();
    const totalAnimais = animais.length;
    const femeas = animais.filter(a => a.sexo === 'Fêmea').length;
    const machos = animais.filter(a => a.sexo === 'Macho').length;
    const prenhas = animais.filter(a => a.status_reprodutivo === 'Prenha').length;
    const lactantes = animais.filter(a => a.status_reprodutivo === 'Lactante').length;
    
    // Get upcoming events (next 7 days)
    const hoje = new Date().toISOString().split('T')[0];
    const semana = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    const { data: eventosProximos } = await supabase.from('eventos')
        .select('*')
        .gte('data_evento', hoje)
        .lte('data_evento', semana)
        .eq('concluido', false);
    
    return { totalAnimais, femeas, machos, prenhas, lactantes, eventosProximos: eventosProximos || [] };
  },

  async getConfiguracoes() {
    const { data, error } = await supabase.from('configuracoes').select('*');
    if (error) throw error;
    return data;
  },

  async saveConfiguracao(chave, valor) {
    const { error } = await supabase.from('configuracoes').upsert({ chave, valor });
    if (error) throw error;
  },

  async exportData() {
    const animais = await supabase.from('animais').select('*');
    const genealogia = await supabase.from('genealogia').select('*');
    const saude = await supabase.from('saude_registros').select('*');
    const reproducao = await supabase.from('reproducao').select('*');
    const anotacoes = await supabase.from('anotacoes').select('*');
    const eventos = await supabase.from('eventos').select('*');
    const pesagens = await supabase.from('pesagens').select('*');
    const config = await supabase.from('configuracoes').select('*');
    return JSON.stringify({
        animais: animais.data,
        genealogia: genealogia.data,
        saude_registros: saude.data,
        reproducao: reproducao.data,
        anotacoes: anotacoes.data,
        eventos: eventos.data,
        pesagens: pesagens.data,
        configuracoes: config.data,
        exported_at: new Date().toISOString()
    }, null, 2);
  },
  
  async getAnimaisMap() {
      const animais = await this.getAnimais();
      const map = {};
      animais.forEach(a => {
          map[a.id] = { nome: a.nome, foto_url: a.foto_url };
      });
      return map;
  },

  async getAllGenealogias() {
    const { data, error } = await supabase.from('genealogia').select('animal_id, pai_id, mae_id');
    if (error) throw error;
    return data || [];
  },

  async importData(json) {
    // Import functionality stub
  }
};
