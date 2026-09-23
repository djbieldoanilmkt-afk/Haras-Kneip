-- 043 — O protocolo vira base de conhecimento com hierarquia de autoridade.
--
-- UM protocolo só, como você pediu. A separação entre padrão oficial e
-- interpretação de jurado não vira outro protocolo: vira o TIPO da fonte.
--
-- A HIERARQUIA É A REGRA CENTRAL
--
--   1 PADRAO_OFICIAL
--   2 REGULAMENTO_OFICIAL
--   3 EDUCACIONAL_OFICIAL
--   4 INTERPRETACAO_JURADO
--   5 REGRA_TECNICA_HARASPRO
--
-- Fala de jurado NUNCA sobrescreve padrão oficial. Isso não pode depender de
-- o modelo lembrar: está no banco, na ordenação da consulta e numa restrição
-- que impede marcar interpretação como regra oficial.
--
-- O QUE EU POSSO E NÃO POSSO PREENCHER
--
-- Os princípios que você trouxe (beleza estética x zootécnica, decompor
-- expressão racial, aprumo estático x dinâmico, morfologia não garante
-- marcha) são METODOLOGIA — como olhar. Isso é REGRA_TECNICA_HARASPRO, e eu
-- posso escrever, porque não afirma nada sobre o padrão da raça.
--
-- Já "garupa deve ter tantos graus" ou "conjunto de frente vale 24 pontos" é
-- REGRA RACIAL. Continuo sem o documento da ABCCMM, então essas ficam vazias.
-- A estrutura está pronta para recebê-las sem migração nova.

begin;

-- ====================================================== fontes

create table if not exists public.morfologia_fontes (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references public.morfologia_protocolos(id) on delete cascade,

  tipo text not null check (tipo in (
    'PADRAO_OFICIAL', 'REGULAMENTO_OFICIAL', 'EDUCACIONAL_OFICIAL',
    'INTERPRETACAO_JURADO', 'REGRA_TECNICA_HARASPRO'
  )),

  titulo text not null,
  autor text,
  cargo text,
  organizacao text,
  evento text,
  ano int,
  url text,
  transcricao text,

  /* Conferido contra o documento oficial por uma pessoa. Nada entra como
     verificado por vir de um modelo. */
  verificada boolean not null default false,
  verificada_em timestamptz,

  criado_em timestamptz not null default now()
);

create index if not exists morfologia_fontes_protocolo_idx
  on public.morfologia_fontes (protocolo_id, tipo);

/** Posto na hierarquia. Menor = mais autoridade. */
create or replace function public.morfologia_autoridade(p_tipo text)
returns int
language sql immutable
as $$
  select case p_tipo
    when 'PADRAO_OFICIAL'         then 1
    when 'REGULAMENTO_OFICIAL'    then 2
    when 'EDUCACIONAL_OFICIAL'    then 3
    when 'INTERPRETACAO_JURADO'   then 4
    when 'REGRA_TECNICA_HARASPRO' then 5
    else 99
  end
$$;

-- ====================================================== conhecimento
--
-- Uma tabela só, com `situacao` fazendo o papel de fila de revisão. A
-- especificação pediu candidato -> revisão -> ativo, e pediu para nao criar
-- dezenas de tabelas: as duas coisas cabem numa coluna.

create table if not exists public.morfologia_conhecimento (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references public.morfologia_protocolos(id) on delete cascade,
  fonte_id uuid references public.morfologia_fontes(id) on delete set null,

  categoria text not null check (categoria in (
    'APARENCIA_GERAL', 'EXPRESSAO_RACIAL', 'CABECA', 'PESCOCO',
    'CONJUNTO_FRENTE', 'TRONCO', 'LINHA_SUPERIOR', 'GARUPA',
    'MEMBROS_ANTERIORES', 'MEMBROS_POSTERIORES', 'APRUMOS', 'ANGULACOES',
    'PROPORCOES', 'MOVIMENTO', 'MARCHA', 'TEMPERAMENTO',
    'ANIMAL_JOVEM', 'CONFORMACAO_FUNCIONAL'
  )),
  subcategoria text,

  afirmacao text not null,
  tipo_fonte text not null,

  confianca numeric(3, 2) check (confianca between 0 and 1),
  /* Marcado quando a afirmação PARECE regra racial e veio de fonte não
     oficial — precisa de conferência antes de valer como critério. */
  requer_verificacao_oficial boolean not null default false,
  possivel_conflito text,

  situacao text not null default 'candidato'
    check (situacao in ('candidato', 'ativo', 'recusado')),

  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por uuid references auth.users(id)
);

/*
  A trava da hierarquia.

  Conhecimento que não vem de fonte oficial não pode ficar ativo enquanto
  estiver marcado como carente de conferência. Sem isto, uma fala de jurado
  entraria no prompt com o mesmo peso do padrão — que é exatamente o que a
  regra final proíbe.
*/
alter table public.morfologia_conhecimento
  drop constraint if exists morfologia_conhecimento_hierarquia;
alter table public.morfologia_conhecimento add constraint morfologia_conhecimento_hierarquia
  check (
    situacao <> 'ativo'
    or not requer_verificacao_oficial
    or tipo_fonte in ('PADRAO_OFICIAL', 'REGULAMENTO_OFICIAL')
  );

create index if not exists morfologia_conhecimento_busca_idx
  on public.morfologia_conhecimento (protocolo_id, categoria, situacao);
create index if not exists morfologia_conhecimento_revisao_idx
  on public.morfologia_conhecimento (situacao) where situacao = 'candidato';

alter table public.morfologia_fontes enable row level security;
alter table public.morfologia_conhecimento enable row level security;

drop policy if exists morfologia_fontes_sel on public.morfologia_fontes;
create policy morfologia_fontes_sel on public.morfologia_fontes for select to authenticated
  using (public.tem_recurso('avaliacao_morfologica'));

drop policy if exists morfologia_conhecimento_sel on public.morfologia_conhecimento;
create policy morfologia_conhecimento_sel on public.morfologia_conhecimento
  for select to authenticated
  using (public.tem_recurso('avaliacao_morfologica'));

revoke insert, update, delete on public.morfologia_fontes from anon, authenticated;
revoke insert, update, delete on public.morfologia_conhecimento from anon, authenticated;

-- ====================================================== busca por critério

/*
  O que mandar ao modelo ao analisar UM critério.

  Não se manda a base inteira a cada avaliação: manda-se o que é daquela
  categoria, na ordem da autoridade. Consulta estruturada resolve — não vale
  montar infraestrutura vetorial para uma base que cabe numa tela.
*/
create or replace function public.morfologia_conhecimento_do_criterio(
  p_protocolo uuid, p_categoria text
)
returns table (
  tipo_fonte text,
  autoridade int,
  afirmacao text,
  fonte text,
  autor text,
  conhecimento_id uuid
)
language sql stable security definer
set search_path = public
as $$
  select k.tipo_fonte,
         public.morfologia_autoridade(k.tipo_fonte),
         k.afirmacao,
         f.titulo,
         f.autor,
         k.id
  from public.morfologia_conhecimento k
  left join public.morfologia_fontes f on f.id = k.fonte_id
  where k.protocolo_id = p_protocolo
    and k.categoria = p_categoria
    and k.situacao = 'ativo'
  order by public.morfologia_autoridade(k.tipo_fonte), k.criado_em
$$;

/*
  Retrato do conhecimento no momento da avaliação.

  O protocolo melhora com o tempo; a avaliação de hoje não pode mudar por
  causa disso. Guardar os ids usados deixa qualquer laudo antigo reproduzível
  e auditável — e é o que permite responder "com base em quê você disse isso?"
  dois anos depois.
*/
alter table public.morfologia_avaliacoes
  add column if not exists conhecimento_instantaneo jsonb;

alter table public.morfologia_notas
  add column if not exists conhecimento_ids uuid[] not null default '{}';

-- ====================================================== ingestão de fonte

/** Cadastra uma fonte bruta (transcrição de jurado, documento oficial). */
create or replace function public.morfologia_registrar_fonte(
  p_user uuid,
  p_tipo text,
  p_titulo text,
  p_transcricao text,
  p_autor text default null,
  p_cargo text default null,
  p_organizacao text default null,
  p_ano int default null,
  p_url text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_protocolo uuid;
  v_id uuid;
begin
  if not public.pode_morfologia(p_user, 'gerir') then
    raise exception 'Só o dono do haras pode alimentar o protocolo.';
  end if;

  select id into v_protocolo from public.morfologia_protocolos
   where raca = 'Mangalarga Marchador'
   order by case situacao when 'vigente' then 0 else 1 end, versao desc limit 1;

  insert into public.morfologia_fontes
    (protocolo_id, tipo, titulo, autor, cargo, organizacao, ano, url, transcricao)
  values
    (v_protocolo, p_tipo, p_titulo, p_autor, p_cargo, p_organizacao, p_ano, p_url,
     p_transcricao)
  returning id into v_id;

  return v_id;
end $$;

/*
  Grava um candidato extraído por IA.

  Entra como CANDIDATO, sempre. O modelo lê a transcrição e propõe; quem
  publica é gente. Extração automática direto para ativo transformaria um
  engano de leitura em regra de avaliação sem ninguém ver.
*/
create or replace function public.morfologia_propor_conhecimento(
  p_fonte uuid,
  p_categoria text,
  p_afirmacao text,
  p_subcategoria text default null,
  p_confianca numeric default null,
  p_requer_verificacao boolean default false,
  p_possivel_conflito text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_protocolo uuid;
  v_tipo text;
  v_id uuid;
begin
  select protocolo_id, tipo into v_protocolo, v_tipo
    from public.morfologia_fontes where id = p_fonte;
  if v_protocolo is null then
    raise exception 'Fonte não encontrada.';
  end if;

  insert into public.morfologia_conhecimento
    (protocolo_id, fonte_id, categoria, subcategoria, afirmacao, tipo_fonte,
     confianca, requer_verificacao_oficial, possivel_conflito, situacao)
  values
    (v_protocolo, p_fonte, p_categoria, p_subcategoria, p_afirmacao, v_tipo,
     p_confianca, p_requer_verificacao, p_possivel_conflito, 'candidato')
  returning id into v_id;

  return v_id;
end $$;

/** Publica ou recusa um candidato. Gente decide, não o modelo. */
create or replace function public.morfologia_revisar_conhecimento(
  p_user uuid, p_id uuid, p_aprovar boolean
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.pode_morfologia(p_user, 'gerir') then
    raise exception 'Só o dono do haras pode revisar o protocolo.';
  end if;

  update public.morfologia_conhecimento
     set situacao = case when p_aprovar then 'ativo' else 'recusado' end,
         revisado_em = now(),
         revisado_por = p_user
   where id = p_id and situacao = 'candidato';

  return found;
end $$;

commit;
