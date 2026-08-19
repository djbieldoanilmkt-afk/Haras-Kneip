/**
 * Tipos das oito tabelas do Supabase (projeto nesnxcmdfksakgspvkcg).
 *
 * Levantados por introspecção via API REST em 2026-08-12, lendo uma linha de
 * cada tabela. A geração automática com `supabase gen types` não foi possível
 * porque a conta conectada não tem acesso a este projeto. Se você tiver acesso,
 * regenere com:
 *
 *   npx supabase gen types typescript --project-id nesnxcmdfksakgspvkcg > src/lib/database.types.ts
 *
 * ATENÇÃO — a nulabilidade abaixo é uma estimativa. A introspecção mostra os
 * nomes e os tipos reais das colunas, mas não distingue "NULL nesta linha" de
 * "coluna NULLABLE". Ao regenerar com a CLI, os tipos ficam exatos.
 */

export type Sexo = 'Fêmea' | 'Macho'

export type StatusConta = 'trial' | 'ativa' | 'bloqueada'

/** O tenant: cada conta do produto é um haras. */
export type Haras = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  status_conta: StatusConta
  trial_expira_em: string
  created_at: string
}

export type Membro = {
  haras_id: string
  user_id: string
  papel: 'dono'
  created_at: string
}

export type Animal = {
  id: string
  nome: string
  apelido: string | null
  registro: string | null
  registro_abccmm: string | null
  raca: string
  pelagem: string | null
  tipo_marcha: string | null
  sexo: Sexo
  data_nascimento: string | null
  peso: number | null
  altura: number | null
  baia_piquete: string | null
  status_reprodutivo: string | null
  status_saude: string | null
  premiacao: string | null
  foto_url: string | null
  observacoes: string | null
  em_destaque: boolean | null
  ativo: boolean
  created_at: string
  updated_at: string | null
}

export type Genealogia = {
  id: string
  animal_id: string
  pai_id: string | null
  mae_id: string | null
  avo_paterno_id: string | null
  avo_paterna_id: string | null
  avo_materno_id: string | null
  avo_materna_id: string | null
  created_at: string
  updated_at: string | null
}

/** Subconjunto devolvido por store.getAllGenealogias. */
export type GenealogiaResumo = Pick<Genealogia, 'animal_id' | 'pai_id' | 'mae_id'>

export type SaudeRegistro = {
  id: string
  animal_id: string
  tipo: string
  descricao: string
  data_registro: string
  proxima_data: string | null
  veterinario: string | null
  custo: number | null
  observacoes: string | null
  created_at: string
  updated_at: string | null
}

/**
 * O app legado gravava `tipo_evento`, `parceiro_nome` e `previsao_parto` nesta
 * tabela. Nenhuma das três existe — os nomes reais são `tipo`, `garanhao` e
 * `data_prevista_parto`. Por isso criar evento reprodutivo falha hoje, e a
 * tabela da aba Reprodução mostra "--" nessas três colunas.
 */
export type Reproducao = {
  id: string
  animal_id: string
  tipo: string
  garanhao: string | null
  metodo: string | null
  data_evento: string
  data_prevista_parto: string | null
  resultado: string | null
  cria_id: string | null
  observacoes: string | null
  created_at: string
  updated_at: string | null
}

/**
 * O app legado gravava `texto` e `autor`. Nenhuma das duas existe — os nomes
 * reais são `titulo` e `conteudo`. Por isso criar anotação falha hoje, e as
 * anotações existentes aparecem em branco.
 */
export type Anotacao = {
  id: string
  animal_id: string
  titulo: string
  conteudo: string
  data_registro: string
  created_at: string
  updated_at: string | null
}

export type Evento = {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  data_evento: string
  animal_id: string | null
  concluido: boolean
  /** Cor gravada no banco. O app usa os tokens do tema, não esta coluna. */
  cor: string | null
  created_at: string
  updated_at: string | null
}

export type Pesagem = {
  id: string
  animal_id: string
  peso: number
  data_pesagem: string
  observacoes: string | null
  created_at: string
  updated_at: string | null
}

export type Configuracao = {
  id: string
  chave: string
  valor: string
  created_at: string
  updated_at: string | null
}

/** Mapa id -> dados mínimos, devolvido por store.getAnimaisMap. */
export type AnimalResumo = {
  nome: string
  foto_url: string | null
}
