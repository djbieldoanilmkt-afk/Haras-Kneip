-- ============================================================================
-- FUNDACAO DO AGENTE DE WHATSAPP
-- Rode depois do 005_despesas.sql.
--
-- Nada aqui e funcionalidade visivel sozinha. Sao as tres coisas que o agente
-- vai exigir e que ficam MUITO mais caras depois que houver dado gravado:
--
--   1. telefone no membro      -> sem isso o agente nao sabe quem esta falando
--   2. autoria e origem        -> sem isso ninguem explica de onde veio um
--                                 lancamento errado, e o dado nao da para
--                                 reconstruir depois
--   3. exclusao reversivel     -> o agente vai errar; desfazer precisa ser um
--                                 clique, nao um chamado
-- ============================================================================

begin;

-- ---------------------------------------------------------------- 1. telefone

alter table public.membros add column if not exists telefone text;
alter table public.membros add column if not exists telefone_verificado_em timestamptz;

-- Unico no sistema inteiro, e nao por haras: um numero de WhatsApp identifica
-- uma pessoa. Se o mesmo numero valesse em dois haras, a mensagem que chegasse
-- dele seria ambigua e o agente teria de adivinhar onde gravar.
-- Parcial porque a maioria dos membros nao tem telefone, e null nao colide.
create unique index if not exists membros_telefone_idx
  on public.membros (telefone)
  where telefone is not null;

-- O dono edita o proprio telefone; o carimbo de verificacao nao, senao daria
-- para se declarar verificado sem passar pelo codigo.
grant update (telefone) on public.membros to authenticated;

drop policy if exists membros_upd on public.membros;
create policy membros_upd on public.membros for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------- 2. autoria e origem

-- Preenche criado_por com quem esta logado, como definir_haras_id faz com o
-- tenant. O agente roda com a sessao do proprio usuario, entao o autor sai
-- correto tambem quando a escrita vem do WhatsApp.
create or replace function public.definir_autoria()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.criado_por is null then
    new.criado_por := auth.uid();
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'animais','genealogia','saude_registros','reproducao',
    'anotacoes','eventos','pesagens','configuracoes','despesas'
  ] loop
    execute format(
      'alter table public.%I add column if not exists criado_por uuid references auth.users(id)', t);

    -- default 'app': tudo que ja existe foi criado pela interface, e o
    -- registro futuro que nao disser nada tambem veio de la.
    execute format($f$
      alter table public.%I add column if not exists origem text not null default 'app'
    $f$, t);

    execute format($f$
      alter table public.%I drop constraint if exists %I
    $f$, t, t || '_origem_valida');

    execute format($f$
      alter table public.%I add constraint %I
        check (origem in ('app', 'whatsapp', 'importacao'))
    $f$, t, t || '_origem_valida');

    execute format(
      'drop trigger if exists %I on public.%I', t || '_definir_autoria', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.definir_autoria()',
      t || '_definir_autoria', t);
  end loop;
end $$;

-- -------------------------------------------------- 3. exclusao reversivel

-- `animais` fica de fora de proposito: ja tem exclusao logica pela coluna
-- `ativo`, e dois mecanismos na mesma tabela e pedido de bug.
do $$
declare
  t text;
begin
  foreach t in array array[
    'saude_registros','reproducao','anotacoes','eventos','pesagens','despesas'
  ] loop
    execute format(
      'alter table public.%I add column if not exists excluido_em timestamptz', t);

    execute format(
      'create index if not exists %I on public.%I (haras_id) where excluido_em is null',
      t || '_vivos_idx', t);

    /*
      O filtro entra na POLITICA de select, e nao nas consultas do app.

      Assim nenhuma das dezenas de consultas existentes precisa mudar, e nao
      existe o risco de alguem esquecer o filtro numa consulta nova e vazar
      registro excluido para a tela.

      O preco disso esta explicado no bloco seguinte: com o filtro aqui, o
      proprio dono da linha nao consegue mais excluir nem restaurar por
      UPDATE direto.
    */
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format($f$
      create policy %1$s_sel on public.%1$I for select to authenticated
        using (haras_id = public.meu_haras_id() and excluido_em is null)
    $f$, t);
  end loop;
end $$;

/*
  Excluir e restaurar precisam ser funcao, e nao UPDATE direto.

  Verificado no banco: o PostgreSQL aplica as politicas de SELECT a linha
  RESULTANTE de um UPDATE. Com `excluido_em is null` na politica de select,
  um `update ... set excluido_em = now()` torna a linha invisivel e o proprio
  comando e recusado com "new row violates row-level security policy" — o
  update inocuo na mesma linha passa, o que esconde a linha nao passa. O
  mesmo vale na volta, para restaurar.

  Dai as duas funcoes security definer. Elas rodam acima do RLS, entao
  checam a mao o que a politica checaria: haras da sessao, permissao de
  escrita e pertencimento da linha.
*/

-- Lista fixa. O nome da tabela entra em SQL dinamico, e aceitar texto livre
-- aqui seria injecao rodando com privilegio de definer. Precisa acompanhar a
-- lista de tabelas com excluido_em, logo acima.
create or replace function public.tabela_reversivel(p_tabela text)
returns boolean
language sql immutable
as $$
  select p_tabela in (
    'saude_registros', 'reproducao', 'anotacoes', 'eventos', 'pesagens', 'despesas'
  )
$$;

create or replace function public.excluir_registro(p_tabela text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_afetadas int;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  if not public.tabela_reversivel(p_tabela) then
    raise exception 'Tabela não permitida: %', p_tabela;
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'Conta sem permissão de escrita.';
  end if;

  execute format(
    'update public.%I set excluido_em = now()
      where id = $1 and haras_id = $2 and excluido_em is null', p_tabela)
    using p_id, v_haras;

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    raise exception 'Registro não encontrado.';
  end if;
end $$;

create or replace function public.restaurar_registro(p_tabela text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_afetadas int;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  if not public.tabela_reversivel(p_tabela) then
    raise exception 'Tabela não permitida: %', p_tabela;
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'Conta sem permissão de escrita.';
  end if;

  execute format(
    'update public.%I set excluido_em = null
      where id = $1 and haras_id = $2 and excluido_em is not null', p_tabela)
    using p_id, v_haras;

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    raise exception 'Registro não encontrado na lixeira.';
  end if;
end $$;

revoke execute on function public.excluir_registro(text, uuid) from anon, public;
revoke execute on function public.restaurar_registro(text, uuid) from anon, public;
grant execute on function public.excluir_registro(text, uuid) to authenticated;
grant execute on function public.restaurar_registro(text, uuid) to authenticated;

commit;
