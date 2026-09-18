-- ============================================================================
-- PAPEIS QUE LIMITAM ESCRITA, E DESPESA GRAVADA EM UMA TRANSACAO
-- Rode depois do 008_verificacao_telefone.sql.
--
-- Ate aqui `papel` so decidia quem convida e remove: um peao escrevia tudo
-- que um dono escrevia, inclusive financeiro. E a despesa era gravada em duas
-- idas ao banco, sem transacao que abrangesse as duas tabelas.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- papeis

/*
  CORRECAO DE BUG DA 007.

  A tabela nasceu (001) com `check (papel = 'dono')`, quando so existia o dono.
  A 007 acrescentou `membros_papel_valido` aceitando dono/gerente/peao, mas NAO
  removeu a antiga — e check constraints somam. Na pratica so 'dono' passava, o
  que quebrava aceitar_convite() no insert do membro: convidar funcionava,
  aceitar estourava.

  Passou despercebido porque o teste da 007 exercitou convidar_membro (que
  escreve em `convites`) e nunca aceitar_convite (que escreve em `membros`).
*/
alter table public.membros drop constraint if exists membros_papel_check;

create or replace function public.meu_papel()
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.membros where user_id = auth.uid() limit 1
$$;

/*
  Quem enxerga dinheiro.

  A linha e o LIVRO, nao o registro isolado: o peao continua lancando e vendo
  o custo de uma vacina que ele mesmo registrou, porque isso faz parte do
  registro sanitario. O que ele nao ve e a tabela de despesas do haras — folha
  de pagamento, racao, ferrageamento — nem os totais que saem dela.
*/
create or replace function public.ve_financeiro()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.meu_papel() in ('dono', 'gerente'), false)
$$;

do $$
declare t text;
begin
  foreach t in array array['despesas', 'despesa_rateios'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
  end loop;
end $$;

-- despesas tem excluido_em (006); despesa_rateios nao — ele cai junto por
-- cascade e nunca e listado sozinho.
create policy despesas_sel on public.despesas for select to authenticated
  using (haras_id = public.meu_haras_id() and excluido_em is null and public.ve_financeiro());

create policy despesas_ins on public.despesas for insert to authenticated
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy despesas_upd on public.despesas for update to authenticated
  using (haras_id = public.meu_haras_id() and public.ve_financeiro())
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy despesas_del on public.despesas for delete to authenticated
  using (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
         and public.ve_financeiro());

create policy despesa_rateios_sel on public.despesa_rateios for select to authenticated
  using (haras_id = public.meu_haras_id() and public.ve_financeiro());

create policy despesa_rateios_ins on public.despesa_rateios for insert to authenticated
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy despesa_rateios_upd on public.despesa_rateios for update to authenticated
  using (haras_id = public.meu_haras_id() and public.ve_financeiro())
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
              and public.ve_financeiro());

create policy despesa_rateios_del on public.despesa_rateios for delete to authenticated
  using (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id)
         and public.ve_financeiro());

-- A identidade do haras (nome, logo) tambem sai das maos do peao.
drop policy if exists haras_upd on public.haras;
create policy haras_upd on public.haras for update to authenticated
  using (id = public.meu_haras_id() and public.ve_financeiro())
  with check (id = public.meu_haras_id() and public.ve_financeiro());

-- A funcao de exclusao reversivel roda acima do RLS, entao a regra de
-- financeiro precisa ser repetida a mao la dentro.
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
  if p_tabela = 'despesas' and not public.ve_financeiro() then
    raise exception 'Seu perfil não tem acesso ao financeiro.';
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
  if p_tabela = 'despesas' and not public.ve_financeiro() then
    raise exception 'Seu perfil não tem acesso ao financeiro.';
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

grant execute on function public.meu_papel() to authenticated;
grant execute on function public.ve_financeiro() to authenticated;

-- ------------------------------------------------- despesa em transacao

/*
  Despesa e rateio numa ida so.

  Antes eram dois INSERTs pelo PostgREST, que nao abre transacao abrangendo as
  duas tabelas: se o segundo falhasse, a despesa ficava viva contando no total
  do mes e sumida do custo por animal. O cliente compensava apagando, o que
  cobre o caso comum e nao cobre queda de rede no meio.

  A divisao em centavos continua no TypeScript (ratearCentavos, com teste que
  percorre 850 combinacoes) e chega pronta em p_rateios. Aqui o banco confere
  o invariante que importa: a soma das partes tem de ser exatamente o valor.
  Sem essa conferencia, um bug no cliente escreveria um rateio que nao fecha e
  ninguem perceberia ate o fechamento do mes.
*/
create or replace function public.criar_despesa(
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_fornecedor text default null,
  p_observacoes text default null,
  p_rateios jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_id uuid;
  v_soma numeric;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'Conta sem permissão de escrita.';
  end if;
  if not public.ve_financeiro() then
    raise exception 'Seu perfil não tem acesso ao financeiro.';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero.';
  end if;

  if jsonb_array_length(p_rateios) > 0 then
    select sum((r ->> 'valor')::numeric) into v_soma
      from jsonb_array_elements(p_rateios) r;

    if v_soma <> p_valor then
      raise exception 'O rateio soma % e a despesa é de % — não fecha.', v_soma, p_valor;
    end if;
  end if;

  insert into public.despesas (haras_id, data, categoria, descricao, valor, fornecedor, observacoes)
  values (v_haras, p_data, p_categoria, p_descricao, p_valor,
          nullif(trim(coalesce(p_fornecedor, '')), ''),
          nullif(trim(coalesce(p_observacoes, '')), ''))
  returning id into v_id;

  if jsonb_array_length(p_rateios) > 0 then
    insert into public.despesa_rateios (despesa_id, animal_id, haras_id, valor)
    select v_id, (r ->> 'animal_id')::uuid, v_haras, (r ->> 'valor')::numeric
      from jsonb_array_elements(p_rateios) r;
  end if;

  return v_id;
end $$;

revoke execute on function public.criar_despesa(date, text, text, numeric, text, text, jsonb)
  from anon, public;
grant execute on function public.criar_despesa(date, text, text, numeric, text, text, jsonb)
  to authenticated;

commit;
