-- ============================================================================
-- FINANCEIRO: DESPESAS DO HARAS COM RATEIO POR ANIMAL
-- Rode depois do 002_rls.sql.
--
-- Ate aqui o unico valor no banco era saude_registros.custo, que so cobre
-- veterinario. Racao, ferrageamento, mao de obra e transporte — que sao a
-- maior parte do custo real — nao tinham onde morar.
--
-- Duas tabelas, e nao uma coluna animal_id em despesas: a mesma nota de racao
-- se divide entre varios animais, entao a relacao e muitos-para-muitos. Com
-- uma coluna so, lancar uma nota rateada entre nove animais exigiria nove
-- despesas duplicadas, e o total do mes sairia inflado nove vezes.
-- ============================================================================

begin;

-- ------------------------------------------------------------- despesas

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  haras_id uuid not null references public.haras(id) on delete cascade,
  data date not null default current_date,
  categoria text not null,
  descricao text not null,
  -- numeric, nunca float: dinheiro em ponto flutuante acumula erro de
  -- arredondamento e o fechamento do mes deixa de bater.
  valor numeric(12, 2) not null check (valor >= 0),
  fornecedor text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- A listagem e sempre "as despesas deste haras, da mais recente para a mais
-- antiga"; o indice cobre exatamente isso.
create index if not exists despesas_haras_data_idx
  on public.despesas (haras_id, data desc);

-- --------------------------------------------------------- rateio

create table if not exists public.despesa_rateios (
  despesa_id uuid not null references public.despesas(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete cascade,
  haras_id uuid not null references public.haras(id) on delete cascade,
  valor numeric(12, 2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  -- Um animal entra uma vez por despesa. Sem esta chave, salvar o mesmo
  -- rateio duas vezes dobraria silenciosamente o custo do animal.
  primary key (despesa_id, animal_id)
);

create index if not exists despesa_rateios_animal_idx
  on public.despesa_rateios (animal_id);

create index if not exists despesa_rateios_haras_idx
  on public.despesa_rateios (haras_id);

-- ------------------------------------------------- RLS no mesmo padrao

do $$
declare
  t text;
begin
  foreach t in array array['despesas', 'despesa_rateios'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy %1$s_sel on public.%1$I for select to authenticated
        using (haras_id = public.meu_haras_id())
    $f$, t);
    execute format($f$
      create policy %1$s_ins on public.%1$I for insert to authenticated
        with check (haras_id = public.meu_haras_id()
                    and public.haras_escreve(haras_id))
    $f$, t);
    execute format($f$
      create policy %1$s_upd on public.%1$I for update to authenticated
        using (haras_id = public.meu_haras_id())
        with check (haras_id = public.meu_haras_id()
                    and public.haras_escreve(haras_id))
    $f$, t);
    execute format($f$
      create policy %1$s_del on public.%1$I for delete to authenticated
        using (haras_id = public.meu_haras_id()
               and public.haras_escreve(haras_id))
    $f$, t);

    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.definir_haras_id()',
      t || '_definir_haras', t);

    -- Como nas outras tabelas: a escrita anonima morre no GRANT, nao so na
    -- politica. Sem isto o PostgREST devolveria "200, zero linhas" para um
    -- UPDATE anonimo em vez de recusar.
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

commit;
