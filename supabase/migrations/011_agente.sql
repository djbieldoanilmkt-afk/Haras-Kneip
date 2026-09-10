-- ============================================================================
-- AGENTE DE WHATSAPP: INTENCAO PENDENTE E ESCRITA CONTROLADA
-- Rode depois do 010_conexao_whatsapp.sql.
--
-- Duas coisas moram aqui:
--
-- 1. `intencoes` — o que o agente entendeu e ainda NAO gravou. Sem isso a
--    confirmacao seria impossivel: "sim" na mensagem seguinte precisa saber a
--    que se refere.
--
-- 2. As funcoes de escrita pelo WhatsApp. Elas recebem o user_id em vez de
--    usar auth.uid(), porque quem chama e o servico do agente e nao o
--    navegador — mas conferem papel e haras do MESMO jeito que o RLS conferiria.
-- ============================================================================

begin;

create table if not exists public.intencoes (
  id uuid primary key default gen_random_uuid(),
  haras_id uuid not null references public.haras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  telefone text not null,

  acao text not null,
  /* O que ja foi entendido. Vai crescendo conforme a pessoa responde. */
  dados jsonb not null default '{}'::jsonb,
  /* Campos obrigatorios que ainda faltam. Vazio = pronto para confirmar. */
  faltando text[] not null default '{}',

  estado text not null default 'coletando'
    check (estado in ('coletando', 'aguardando_confirmacao')),

  /*
    Prazo curto de proposito. Um "sim" solto duas horas depois quase nunca se
    refere ao que o agente perguntou — e gravar a coisa errada por causa disso
    e pior do que pedir para repetir.
  */
  expira_em timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);

-- Uma intencao viva por telefone: a conversa e uma so.
create unique index if not exists intencoes_telefone_idx on public.intencoes (telefone);

create index if not exists intencoes_expiracao_idx on public.intencoes (expira_em);

alter table public.intencoes enable row level security;

/*
  Ninguem le isto pelo navegador — nem o dono.

  E rascunho do agente, com prazo de 30 minutos, e expor na API so criaria
  superficie sem entregar valor. O servico usa service_role, que passa por
  cima do RLS.
*/
revoke all on public.intencoes from anon, authenticated;

-- --------------------------------------------------- escrita pelo agente

/*
  Confere o que o RLS conferiria, mas para um usuario passado por parametro.

  O servico do agente nao tem sessao de navegador, entao auth.uid() e nulo la
  dentro. Em vez de escrever com service_role e torcer, a checagem vem para o
  banco e fica num lugar so.
*/
create or replace function public.agente_pode_escrever(p_user uuid, p_financeiro boolean default false)
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
begin
  select haras_id, papel into v_haras, v_papel
    from public.membros where user_id = p_user;

  if v_haras is null then
    raise exception 'Usuário sem haras.';
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'Conta sem permissão de escrita.';
  end if;
  if p_financeiro and v_papel not in ('dono', 'gerente') then
    raise exception 'Seu perfil não tem acesso ao financeiro.';
  end if;

  return v_haras;
end $$;

create or replace function public.agente_lancar_despesa(
  p_user uuid,
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_fornecedor text default null,
  p_animais uuid[] default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, true);
  v_id uuid;
  v_qtd int := coalesce(array_length(p_animais, 1), 0);
  v_centavos bigint;
  v_base bigint;
  v_resto bigint;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero.';
  end if;

  insert into public.despesas
    (haras_id, data, categoria, descricao, valor, fornecedor, criado_por, origem)
  values
    (v_haras, coalesce(p_data, current_date), p_categoria, p_descricao, p_valor,
     nullif(trim(coalesce(p_fornecedor, '')), ''), p_user, 'whatsapp')
  returning id into v_id;

  if v_qtd > 0 then
    /*
      Rateio em centavos inteiros, com o resto distribuido um a um — a mesma
      regra de ratearCentavos no TypeScript. Aqui e refeita em SQL porque o
      agente grava sem passar pelo cliente, e arredondar cada parte deixaria
      a soma diferente do valor da nota.
    */
    v_centavos := round(p_valor * 100);
    v_base := v_centavos / v_qtd;
    v_resto := v_centavos - v_base * v_qtd;

    insert into public.despesa_rateios (despesa_id, animal_id, haras_id, valor)
    select
      v_id,
      a.id,
      v_haras,
      (v_base + case when a.pos <= v_resto then 1 else 0 end) / 100.0
    from (
      select unnest(p_animais) as id, generate_series(1, v_qtd) as pos
    ) a;
  end if;

  return v_id;
end $$;

create or replace function public.agente_lancar_sanidade(
  p_user uuid,
  p_animal uuid,
  p_tipo text,
  p_descricao text,
  p_data date default null,
  p_proxima_data date default null,
  p_custo numeric default null,
  p_veterinario text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
begin
  -- Animal de outro haras nunca pode entrar: e o mesmo isolamento do RLS.
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  insert into public.saude_registros
    (haras_id, animal_id, tipo, descricao, data_registro, proxima_data, custo,
     veterinario, criado_por, origem)
  values
    (v_haras, p_animal, p_tipo, coalesce(p_descricao, ''), coalesce(p_data, current_date),
     p_proxima_data, p_custo, nullif(trim(coalesce(p_veterinario, '')), ''),
     p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

/** Nomes do plantel, para o agente casar o que a pessoa falou. */
create or replace function public.agente_plantel(p_user uuid)
returns table (id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.nome
  from public.animais a
  join public.membros m on m.haras_id = a.haras_id
  where m.user_id = p_user and a.ativo = true
  order by a.nome
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'agente_pode_escrever(uuid, boolean)',
    'agente_lancar_despesa(uuid, date, text, text, numeric, text, uuid[])',
    'agente_lancar_sanidade(uuid, uuid, text, text, date, date, numeric, text)',
    'agente_plantel(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from anon, authenticated, public', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
