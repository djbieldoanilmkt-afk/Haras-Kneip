-- 023 — O outro lado do caixa.
--
-- Até aqui só existiam despesas. O Financeiro mostrava quanto o haras gasta e
-- nunca quanto ele ganha, então não fechava lucro nem prejuízo — que é a
-- pergunta que o dono realmente faz. Venda de animal, cobertura vendida,
-- hospedagem e prestação de serviço não tinham onde morar.
--
-- UMA TABELA, SEM RATEIO
--
-- Despesa tem `despesa_rateios` porque a mesma nota de ração se divide entre
-- vários animais. Receita quase nunca se divide: a venda é de UM animal, a
-- cobertura é de UM garanhão, a hospedagem é de UM hóspede. Onde não há
-- animal (prestação de serviço), o campo fica nulo. Criar a tabela de rateio
-- "por simetria" seria carregar uma junção a mais em toda consulta para um
-- caso que não acontece.

begin;

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  haras_id uuid not null references public.haras(id) on delete cascade,
  data date not null default current_date,
  categoria text not null,
  descricao text not null,
  -- numeric, nunca float: dinheiro em ponto flutuante acumula erro e o
  -- fechamento do mês deixa de bater.
  valor numeric(12, 2) not null check (valor >= 0),
  cliente text,
  /*
    O animal que gerou a receita.

    `on delete set null`, e não `cascade`: apagar um animal não pode apagar a
    venda dele. O dinheiro entrou de verdade e precisa continuar no
    fechamento do ano, mesmo que o animal saia do plantel — que é justamente
    o que acontece depois de uma venda.
  */
  animal_id uuid references public.animais(id) on delete set null,
  forma_pagamento text,
  observacoes text,
  criado_por uuid references auth.users(id),
  origem text not null default 'app',
  excluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

/*
  Lista fechada, alinhada letra a letra com src/lib/categorias.ts.

  Já aconteceu neste projeto: a tela oferecia 'Vacina' e a coluna exigia
  'Vacinação', então escolher a PRIMEIRA opção do menu estourava violação de
  restrição. Quem mexer numa das duas listas tem de mexer na outra.
*/
alter table public.receitas drop constraint if exists receitas_categoria_check;
alter table public.receitas add constraint receitas_categoria_check
  check (categoria in (
    'Venda de animal',
    'Cobertura',
    'Hospedagem',
    'Prestação de serviço',
    'Premiação',
    'Aluguel',
    'Outros'
  ));

create index if not exists receitas_haras_data_idx
  on public.receitas (haras_id, data desc);
create index if not exists receitas_animal_idx
  on public.receitas (animal_id);
create index if not exists receitas_criado_por_idx
  on public.receitas (criado_por);

-- ------------------------------------------------- RLS igual ao de despesas

alter table public.receitas enable row level security;

drop policy if exists receitas_sel on public.receitas;
drop policy if exists receitas_ins on public.receitas;
drop policy if exists receitas_upd on public.receitas;
drop policy if exists receitas_del on public.receitas;

create policy receitas_sel on public.receitas for select to authenticated
  using (haras_id = public.meu_haras_id() and excluido_em is null
         and public.ve_financeiro());

create policy receitas_ins on public.receitas for insert to authenticated
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy receitas_upd on public.receitas for update to authenticated
  using (haras_id = public.meu_haras_id() and public.ve_financeiro())
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy receitas_del on public.receitas for delete to authenticated
  using (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
         and public.ve_financeiro());

drop trigger if exists receitas_definir_haras on public.receitas;
create trigger receitas_definir_haras before insert on public.receitas
  for each row execute function public.definir_haras_id();

drop trigger if exists receitas_definir_autoria on public.receitas;
create trigger receitas_definir_autoria before insert on public.receitas
  for each row execute function public.definir_autoria();

-- A escrita anônima morre no GRANT, não só na política: sem isto o PostgREST
-- devolveria "200, zero linhas" para um UPDATE anônimo em vez de recusar.
revoke insert, update, delete on public.receitas from anon;

-- ------------------------------------------- desfazer alcança receita também

create or replace function public.tabela_reversivel(p_tabela text)
returns boolean
language sql immutable
as $$
  select p_tabela in (
    'saude_registros', 'reproducao', 'anotacoes', 'eventos', 'pesagens',
    'despesas', 'receitas'
  )
$$;

commit;
