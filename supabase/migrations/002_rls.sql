-- ============================================================================
-- FUNDACAO SAAS - PARTE 2 DE 3: SEGURANCA (RLS)
-- Rode depois do 001_tenancy.sql.
-- A partir daqui, cada conta so enxerga os proprios dados, a escrita anonima
-- morre, e o trial vencido bloqueia escrita mesmo fora da interface.
-- ============================================================================

begin;

-- ------------------------------------------------------------- funcoes base

-- Haras do usuario logado (null para anonimo).
create or replace function public.meu_haras_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select haras_id from public.membros where user_id = auth.uid() limit 1
$$;

-- Conta pode escrever? (ativa, ou trial ainda vigente)
create or replace function public.haras_escreve(p_haras uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.haras h
    where h.id = p_haras
      and (h.status_conta = 'ativa'
           or (h.status_conta = 'trial' and h.trial_expira_em > now()))
  )
$$;

-- Preenche haras_id automaticamente nos inserts autenticados.
create or replace function public.definir_haras_id()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.haras_id is null then
    new.haras_id := public.meu_haras_id();
  end if;
  return new;
end $$;

-- Onboarding: cria o haras e o vinculo do usuario, atomico.
-- Inserts diretos em haras/membros sao revogados; este e o unico caminho.
create or replace function public.criar_haras(p_nome text, p_slug text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Este usuário já pertence a um haras.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do haras.';
  end if;

  insert into public.haras (nome, slug) values (trim(p_nome), p_slug)
  returning id into v_id;

  insert into public.membros (haras_id, user_id, papel)
  values (v_id, auth.uid(), 'dono');

  return v_id;
exception
  when unique_violation then
    raise exception 'Este endereço já está em uso. Escolha outro.';
end $$;

-- ------------------------------------- limpa politicas antigas e liga RLS
do $$
declare
  r record;
  t text;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('animais','genealogia','saude_registros','reproducao',
                        'anotacoes','eventos','pesagens','configuracoes',
                        'haras','membros')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach t in array array[
    'animais','genealogia','saude_registros','reproducao',
    'anotacoes','eventos','pesagens','configuracoes','haras','membros'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ------------------------- politicas por tenant nas oito tabelas de dados
do $$
declare
  t text;
begin
  foreach t in array array[
    'animais','genealogia','saude_registros','reproducao',
    'anotacoes','eventos','pesagens','configuracoes'
  ] loop
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
  end loop;
end $$;

-- --------------------------------------------- vitrine publica (leitura)
-- Tambem vale para authenticated: politicas somam por OR, entao um usuario
-- logado continua vendo a vitrine de outros haras.
create policy haras_vitrine on public.haras for select to anon, authenticated
  using (status_conta in ('trial', 'ativa') or id = public.meu_haras_id());

create policy animais_vitrine on public.animais for select to anon, authenticated
  using (
    em_destaque = true and ativo = true
    and exists (select 1 from public.haras h
                where h.id = haras_id and h.status_conta in ('trial', 'ativa'))
  );

create policy genealogia_vitrine on public.genealogia for select to anon, authenticated
  using (
    exists (select 1 from public.animais a
            where a.id = genealogia.animal_id
              and a.em_destaque = true and a.ativo = true)
    and exists (select 1 from public.haras h
                where h.id = haras_id and h.status_conta in ('trial', 'ativa'))
  );

-- ----------------------------------------------------- haras e membros
create policy membros_sel on public.membros for select to authenticated
  using (user_id = auth.uid());

create policy haras_upd on public.haras for update to authenticated
  using (id = public.meu_haras_id())
  with check (id = public.meu_haras_id());

-- O dono edita nome e logo, mas NAO o proprio status_conta nem o trial —
-- grant por coluna impede driblar o bloqueio.
revoke insert, update, delete on public.haras from anon, authenticated;
grant update (nome, logo_url) on public.haras to authenticated;

revoke insert, update, delete on public.membros from anon, authenticated;

commit;
