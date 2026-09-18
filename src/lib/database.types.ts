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
  plano: PlanoId
  created_at: string
}

export type PlanoId = 'essencial' | 'haras' | 'plantel'

export type Papel = 'dono' | 'gerente' | 'peao'

/** Uma linha de minha_equipe(): o e-mail vive em auth.users, fora do RLS. */
export type MembroEquipe = {
  user_id: string
  email: string
  papel: Papel
  telefone: string | null
  /** Null enquanto ninguém provou o número mandando o PIN pelo WhatsApp. */
  verificado_em: string | null
  /** Há um PIN em aberto. O código em si não vem na listagem de propósito. */
  tem_pin: boolean
  desde: string
}

export type Convite = {
  id: string
  haras_id: string
  email: string
  papel: Exclude<Papel, 'dono'>
  created_at: string
  aceito_em: string | null
}

/** Convite visto do lado de quem foi convidado. */
export type ConviteRecebido = {
  id: string
  haras_nome: string
  papel: Exclude<Papel, 'dono'>
}

export type Membro = {
  haras_id: string
  user_id: string
  papel: Papel
  /** E.164 normalizado (+55DDNNNNNNNNN). É por ele que o agente de WhatsApp
   *  descobre quem mandou a mensagem e em qual haras gravar. */
  telefone: string | null
  telefone_verificado_em: string | null
  created_at: string
}

/**
 * De onde veio o registro (006_fundacao_agente.sql). Sem isto, um lançamento
 * errado não tem como ser atribuído — não dá para saber se alguém digitou ou
 * se o agente entendeu mal o áudio.
 */
export type Origem = 'app' | 'whatsapp' | 'importacao'

/** Colunas que 006 acrescentou a todas as tabelas de dados. */
export type Autoria = {
  criado_por: string | null
  origem: Origem
}

/** Tabelas cuja exclusão é reversível — a mesma lista de tabela_reversivel(). */
export const TABELAS_REVERSIVEIS = [
  'saude_registros',
  'reproducao',
  'anotacoes',
  'eventos',
  'pesagens',
  'despesas',
  'receitas',
] as const

export type TabelaReversivel = (typeof TABELAS_REVERSIVEIS)[number]

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
  /** Matriz, Doadora ou Receptora. So faz sentido para femea. */
  funcao_reprodutiva: string | null
  status_saude: string | null
  premiacao: string | null
  foto_url: string | null
  observacoes: string | null
  em_destaque: boolean | null
  ativo: boolean
  /**
   * Existe só para fechar a árvore genealógica — tipicamente o garanhão de
   * outro haras. Não é do plantel: fica fora das listas, das estatísticas e
   * do limite do plano, mas aparece na árvore.
   */
  externo: boolean
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
  /**
   * A mae GENETICA: doadora na transferencia de embriao, matriz na monta
   * natural. E esta que a genealogia do potro usa.
   */
  animal_id: string
  tipo: string
  garanhao: string | null
  metodo: string | null
  /** Quem gesta e pare, so na transferencia de embriao. Fora da genealogia. */
  receptora_id: string | null
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

/**
 * Despesa do haras (005_despesas.sql). Diferente de saude_registros.custo,
 * que só cobre o que passa pelo veterinário, aqui entra ração, ferrageamento,
 * mão de obra e transporte — a maior parte do custo real.
 */
export type Despesa = {
  id: string
  haras_id: string
  data: string
  categoria: string
  descricao: string
  valor: number
  fornecedor: string | null
  observacoes: string | null
  created_at: string
  updated_at: string | null
}

/**
 * Uma linha por animal que divide a despesa. A soma das linhas de uma despesa
 * é sempre igual ao valor dela — ver ratearCentavos em lib/dinheiro.ts.
 */
export type DespesaRateio = {
  despesa_id: string
  animal_id: string
  haras_id: string
  valor: number
  created_at: string
}
