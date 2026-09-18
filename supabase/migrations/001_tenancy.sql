-- ============================================================================
-- FUNDACAO SAAS - PARTE 1 DE 3: TENANCY
-- Rode este arquivo primeiro, no SQL Editor do Supabase.
-- Cria as tabelas de conta (haras, membros), insere o Haras Kneip como
-- tenant numero 1 e adiciona haras_id em todas as tabelas existentes.
-- ============================================================================

begin;

-- ------------------------------------------------------------------ haras
create table if not exists public.haras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  logo_url text,
  status_conta text not null default 'trial'
    check (status_conta in ('trial', 'ativa', 'bloqueada')),
  trial_expira_em timestamptz not null default now() + interval '15 days',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- membros
create table if not exists public.membros (
  haras_id uuid not null references public.haras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'dono' check (papel in ('dono')),
  created_at timestamptz not null default now(),
  primary key (haras_id, user_id)
);

-- v1: um usuario pertence a um unico haras
create unique index if not exists membros_um_haras_por_usuario
  on public.membros (user_id);

-- ------------------------------------------- Haras Kneip = tenant numero 1
-- Conta ativa (o dono do produto nao fica em trial). UUID fixo para o
-- backfill e para o vinculo do usuario depois do cadastro.
insert into public.haras (id, nome, slug, status_conta)
values ('00000000-0000-0000-0000-000000000001', 'Haras Kneip', 'haras-kneip', 'ativa')
on conflict (slug) do nothing;

-- ------------------------------- haras_id nas oito tabelas, com backfill
do $$
declare
  t text;
begin
  foreach t in array array[
    'animais', 'genealogia', 'saude_registros', 'reproducao',
    'anotacoes', 'eventos', 'pesagens', 'configuracoes'
  ] loop
    execute format(
      'alter table public.%I add column if not exists haras_id uuid references public.haras(id)', t);
    execute format(
      'update public.%I set haras_id = %L where haras_id is null',
      t, '00000000-0000-0000-0000-000000000001');
    execute format(
      'alter table public.%I alter column haras_id set not null', t);
    execute format(
      'create index if not exists %I on public.%I (haras_id)', t || '_haras_idx', t);
  end loop;
end $$;

-- --------------------- configuracoes: chave passa a ser unica POR haras
-- Remove qualquer constraint/indice unico antigo sobre (chave) sozinha.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.configuracoes'::regclass
      and contype = 'u'
  loop
    execute format('alter table public.configuracoes drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists configuracoes_chave_por_haras
  on public.configuracoes (haras_id, chave);

commit;
