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

create or replace function public.agente_lancar_pesagem(
  p_user uuid,
  p_animal uuid,
  p_peso numeric,
  p_data date default null,
  p_observacoes text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  /*
    Faixa de sanidade, nao de precisao.

    Cavalo adulto fica entre 300 e 600 kg; potro recem-nascido, perto de 50.
    O limite existe para pegar o erro grosseiro da transcricao — "quarenta e
    dois" virando 42 quando eram 420 — sem tentar adivinhar o peso certo.
  */
  if p_peso is null or p_peso < 20 or p_peso > 1200 then
    raise exception 'Peso fora do esperado para um equino: % kg.', p_peso;
  end if;

  insert into public.pesagens
    (haras_id, animal_id, peso, data_pesagem, observacoes, criado_por, origem)
  values
    (v_haras, p_animal, p_peso, coalesce(p_data, current_date),
     nullif(trim(coalesce(p_observacoes, '')), ''), p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_cadastrar_animal(
  p_user uuid,
  p_nome text,
  p_sexo text,
  p_pelagem text default null,
  p_data_nascimento date default null,
  p_tipo_marcha text default null,
  p_registro_abccmm text default null,
  p_baia_piquete text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
  v_sexo text;
begin
  if v_nome = '' then
    raise exception 'Informe o nome do animal.';
  end if;

  /*
    Sexo entra como a pessoa falou e sai no formato da coluna.

    Exigir exatamente 'Fêmea' seria uma armadilha num sistema de voz: a
    transcricao devolve "femea" sem acento, o modelo pode mandar "F", e no
    curral se diz "egua" e "garanhao". Todos significam a mesma coisa e todos
    quebrariam o cadastro por um detalhe de digitacao que ninguem falou.
  */
  v_sexo := case
    when lower(p_sexo) in ('f', 'fêmea', 'femea', 'fem', 'égua', 'egua', 'potra', 'matriz')
      then 'Fêmea'
    when lower(p_sexo) in ('m', 'macho', 'garanhão', 'garanhao', 'potro', 'cavalo')
      then 'Macho'
    else null
  end;

  if v_sexo is null then
    raise exception 'Não entendi o sexo do animal (recebi "%"). Diga fêmea ou macho.', p_sexo;
  end if;

  /*
    Nome repetido no mesmo haras e recusado.

    Por voz o risco nao e teorico: quem manda "cadastra a Estrela" duas vezes
    porque nao viu a confirmacao acaba com dois animais iguais, e a partir dai
    todo lancamento fica ambiguo. Melhor recusar e mandar diferenciar.
  */
  if exists (
    select 1 from public.animais
    where haras_id = v_haras and ativo = true and lower(nome) = lower(v_nome)
  ) then
    raise exception 'Já existe um animal chamado % neste haras.', v_nome;
  end if;

  insert into public.animais
    (haras_id, nome, sexo, raca, pelagem, data_nascimento, tipo_marcha,
     registro_abccmm, baia_piquete, ativo, criado_por, origem)
  values
    (v_haras, v_nome, v_sexo, 'Mangalarga Marchador',
     nullif(trim(coalesce(p_pelagem, '')), ''), p_data_nascimento,
     nullif(trim(coalesce(p_tipo_marcha, '')), ''),
     nullif(trim(coalesce(p_registro_abccmm, '')), ''),
     nullif(trim(coalesce(p_baia_piquete, '')), ''),
     true, p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_lancar_reproducao(
  p_user uuid,
  p_animal uuid,
  p_tipo text,
  p_data date default null,
  p_garanhao text default null,
  p_metodo text default null,
  p_data_prevista_parto date default null,
  p_resultado text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
  v_data date := coalesce(p_data, current_date);
  v_parto date := p_data_prevista_parto;
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  /*
    Gestacao de equino: ~340 dias.

    Calculado aqui quando a cobertura nao traz a data prevista, porque e
    conta que ninguem faz de cabeca no curral — e sem ela o parto nao entra
    no painel nem no alerta.
  */
  if v_parto is null and p_tipo ilike '%cobertura%' then
    v_parto := v_data + 340;
  end if;

  insert into public.reproducao
    (haras_id, animal_id, tipo, data_evento, garanhao, metodo,
     data_prevista_parto, resultado, criado_por, origem)
  values
    (v_haras, p_animal, p_tipo, v_data,
     nullif(trim(coalesce(p_garanhao, '')), ''),
     nullif(trim(coalesce(p_metodo, '')), ''),
     v_parto,
     nullif(trim(coalesce(p_resultado, '')), ''),
     p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

-- ------------------------------------------------------------ consultas
--
-- Conjunto FIXO de perguntas com parametros. O modelo escolhe qual chamar e
-- com que argumentos; ele nunca escreve SQL. Consulta gerada por modelo
-- vazaria entre haras e deixaria peao ler financeiro, e bastaria uma
-- instrucao maliciosa dentro de uma mensagem para tentar explorar.

create or replace function public.agente_consulta_custos(
  p_user uuid,
  p_animal uuid default null,
  p_desde date default null,
  p_ate date default null,
  p_termo text default null
)
returns table (data date, fonte text, descricao text, valor numeric)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
  v_desde date := coalesce(p_desde, current_date - 365);
  v_ate date := coalesce(p_ate, current_date);
  v_termo text := nullif(trim(coalesce(p_termo, '')), '');
begin
  select haras_id, papel into v_haras, v_papel from public.membros where user_id = p_user;
  if v_haras is null then
    raise exception 'Usuário sem haras.';
  end if;

  return query
  -- Sanidade: todo mundo enxerga, porque o custo faz parte do registro.
  select s.data_registro, 'Sanidade'::text,
         (s.tipo || coalesce(' — ' || nullif(s.descricao, ''), ''))::text,
         s.custo
  from public.saude_registros s
  where s.haras_id = v_haras
    and s.excluido_em is null
    and s.custo is not null
    and s.data_registro between v_desde and v_ate
    and (p_animal is null or s.animal_id = p_animal)
    and (v_termo is null or s.tipo ilike '%' || v_termo || '%'
         or s.descricao ilike '%' || v_termo || '%')

  union all

  -- Despesas: so para quem tem acesso ao livro.
  select d.data, 'Despesa'::text,
         (d.categoria || ' — ' || d.descricao)::text,
         case when p_animal is null then d.valor else r.valor end
  from public.despesas d
  left join public.despesa_rateios r on r.despesa_id = d.id and r.animal_id = p_animal
  where v_papel in ('dono', 'gerente')
    and d.haras_id = v_haras
    and d.excluido_em is null
    and d.data between v_desde and v_ate
    and (p_animal is null or r.animal_id is not null)
    and (v_termo is null or d.categoria ilike '%' || v_termo || '%'
         or d.descricao ilike '%' || v_termo || '%')

  order by 1 desc;
end $$;

create or replace function public.agente_consulta_animais(
  p_user uuid,
  p_status text default null,
  p_local text default null,
  p_termo text default null
)
returns table (nome text, sexo text, pelagem text, status text, local text, nascimento date)
language sql stable security definer
set search_path = public
as $$
  select a.nome, a.sexo, a.pelagem, a.status_reprodutivo, a.baia_piquete, a.data_nascimento
  from public.animais a
  join public.membros m on m.haras_id = a.haras_id
  where m.user_id = p_user
    and a.ativo = true
    and (p_status is null or a.status_reprodutivo ilike '%' || p_status || '%')
    and (p_local is null or a.baia_piquete ilike '%' || p_local || '%')
    and (p_termo is null or a.nome ilike '%' || p_termo || '%')
  order by a.nome
$$;

/** Pendências sanitárias e partos previstos, para "o que vem por aí". */
create or replace function public.agente_consulta_agenda(p_user uuid, p_dias int default 30)
returns table (data date, tipo text, animal text, detalhe text)
language sql stable security definer
set search_path = public
as $$
  select s.proxima_data, 'Sanidade'::text, a.nome,
         (s.tipo || coalesce(' — ' || nullif(s.descricao, ''), ''))::text
  from public.saude_registros s
  join public.animais a on a.id = s.animal_id
  join public.membros m on m.haras_id = s.haras_id
  where m.user_id = p_user
    and s.excluido_em is null
    and s.proxima_data is not null
    and s.proxima_data <= current_date + p_dias

  union all

  select r.data_prevista_parto, 'Parto previsto'::text, a.nome,
         coalesce('Garanhão: ' || r.garanhao, 'Garanhão não informado')::text
  from public.reproducao r
  join public.animais a on a.id = r.animal_id
  join public.membros m on m.haras_id = r.haras_id
  where m.user_id = p_user
    and r.excluido_em is null
    and r.cria_id is null
    and r.data_prevista_parto is not null
    and r.data_prevista_parto <= current_date + p_dias

  order by 1
$$;

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
    'agente_lancar_pesagem(uuid, uuid, numeric, date, text)',
    'agente_cadastrar_animal(uuid, text, text, text, date, text, text, text)',
    'agente_lancar_reproducao(uuid, uuid, text, date, text, text, date, text)',
    'agente_consulta_custos(uuid, uuid, date, date, text)',
    'agente_consulta_animais(uuid, text, text, text)',
    'agente_consulta_agenda(uuid, int)',
    'agente_plantel(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from anon, authenticated, public', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
