-- ============================================================================
-- AGENTE COMPLETO: FICHA, ANOTACAO, EVENTO, LOTE, DESFAZER E RESUMO DIARIO
-- Rode depois do 014_genealogia_autonoma.sql.
--
-- Fecha as lacunas do uso diario:
--
--   FICHA        "me fala tudo da Aurora" — a pergunta mais natural que havia
--   ANOTACAO     e EVENTO: as duas tabelas fora do alcance do agente
--   LOTE         "vacinei todas as eguas" — no curral se faz em lote
--   DESFAZER     errar pelo celular e ter de abrir o computador derrota o
--                proposito inteiro do assistente
--   RESUMO       o agente falando primeiro, que e o que muda a natureza da
--                coisa: de sistema que se consulta para sistema que cobra
-- ============================================================================

begin;

-- ------------------------------------------------------------------ ficha

/*
  Tudo sobre um animal numa consulta.

  Devolve json, e nao table, porque sao blocos de formatos diferentes — dados,
  ultima pesagem, proxima sanidade, pais, custo — e uma tabela unica forcaria
  colunas nulas em quase todas as linhas.
*/
create or replace function public.agente_ficha_animal(p_user uuid, p_animal uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
  v_json json;
begin
  select haras_id, papel into v_haras, v_papel from public.membros where user_id = p_user;
  if v_haras is null then
    raise exception 'Usuário sem haras.';
  end if;

  select json_build_object(
    'nome', a.nome,
    'sexo', a.sexo,
    'pelagem', a.pelagem,
    'marcha', a.tipo_marcha,
    'nascimento', a.data_nascimento,
    'status', a.status_reprodutivo,
    'local', a.baia_piquete,
    'registro', a.registro_abccmm,
    'foto', a.foto_url,

    'peso', (select json_build_object('kg', p.peso, 'quando', p.data_pesagem)
               from public.pesagens p
              where p.animal_id = a.id and p.excluido_em is null
              order by p.data_pesagem desc limit 1),

    'proxima_sanidade', (select json_build_object('tipo', s.tipo, 'quando', s.proxima_data)
               from public.saude_registros s
              where s.animal_id = a.id and s.excluido_em is null
                and s.proxima_data is not null
              order by s.proxima_data limit 1),

    'pai', (select x.nome from public.genealogia g
              join public.animais x on x.id = g.pai_id where g.animal_id = a.id),
    'mae', (select x.nome from public.genealogia g
              join public.animais x on x.id = g.mae_id where g.animal_id = a.id),

    -- Custo so para quem enxerga o livro; peao ve a ficha sem o dinheiro.
    'custo_total', case when v_papel in ('dono', 'gerente') then (
        coalesce((select sum(s.custo) from public.saude_registros s
                   where s.animal_id = a.id and s.excluido_em is null), 0)
      + coalesce((select sum(r.valor) from public.despesa_rateios r
                   join public.despesas d on d.id = r.despesa_id
                  where r.animal_id = a.id and d.excluido_em is null), 0)
    ) end
  ) into v_json
  from public.animais a
  where a.id = p_animal and a.haras_id = v_haras;

  if v_json is null then
    raise exception 'Animal não encontrado neste haras.';
  end if;
  return v_json;
end $$;

-- -------------------------------------------------- anotacao e evento

create or replace function public.agente_lancar_anotacao(
  p_user uuid,
  p_animal uuid,
  p_titulo text,
  p_conteudo text,
  p_data date default null
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

  insert into public.anotacoes
    (haras_id, animal_id, titulo, conteudo, data_registro, criado_por, origem)
  values
    (v_haras, p_animal, coalesce(nullif(trim(p_titulo), ''), 'Anotação'),
     p_conteudo, coalesce(p_data, current_date), p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_lancar_evento(
  p_user uuid,
  p_titulo text,
  p_tipo text,
  p_data date,
  p_animal uuid default null,
  p_descricao text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
  v_tipo text;
begin
  /*
    `eventos.tipo` tem lista fechada e diferente da de sanidade — aqui existe
    "Parto Previsto" e nao existe "Exame". Traduzir aqui evita que a fala vire
    violacao de constraint.
  */
  v_tipo := case
    when p_tipo ilike '%vacin%' then 'Vacinação'
    when p_tipo ilike '%vermifug%' then 'Vermifugação'
    when p_tipo ilike '%part%' then 'Parto Previsto'
    when p_tipo ilike '%ferra%' or p_tipo ilike '%casco%' then 'Ferração'
    when p_tipo ilike '%veterin%' then 'Veterinário'
    when p_tipo ilike '%cobr%' or p_tipo ilike '%cobert%' then 'Cobertura'
    else 'Outro'
  end;

  if p_animal is not null
     and not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  insert into public.eventos
    (haras_id, titulo, tipo, data_evento, animal_id, descricao, concluido, criado_por, origem)
  values
    (v_haras, p_titulo, v_tipo, coalesce(p_data, current_date), p_animal,
     nullif(trim(coalesce(p_descricao, '')), ''), false, p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------- lote

/*
  Um registro de sanidade para varios animais.

  No curral se vacina o lote inteiro de uma vez, e obrigar a repetir o audio
  animal por animal seria pior que a planilha. Roda numa transacao so: ou entra
  para todos ou nao entra para ninguem — meio lote gravado seria pior que
  nenhum, porque ninguem saberia onde parou.
*/
create or replace function public.agente_lancar_sanidade_lote(
  p_user uuid,
  p_animais uuid[],
  p_tipo text,
  p_descricao text,
  p_data date default null,
  p_proxima_data date default null,
  p_custo numeric default null,
  p_veterinario text default null
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_animal uuid;
  v_n int := 0;
begin
  if p_animais is null or array_length(p_animais, 1) is null then
    raise exception 'Nenhum animal informado.';
  end if;

  foreach v_animal in array p_animais loop
    perform public.agente_lancar_sanidade(
      p_user, v_animal, p_tipo, p_descricao, p_data, p_proxima_data, p_custo, p_veterinario);
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

-- ------------------------------------------------------------- desfazer

/*
  O ultimo lancamento desta pessoa, em qualquer tabela reversivel.

  Precisa varrer as cinco porque quem diz "apaga o ultimo" nao pensa em tabela
  — pensa no que acabou de falar.
*/
create or replace function public.agente_ultimo_lancamento(p_user uuid)
returns table (tabela text, id uuid, descricao text, quando timestamptz)
language sql stable security definer
set search_path = public
as $$
  select * from (
    select 'despesas'::text, d.id, (d.categoria || ' — ' || d.descricao)::text, d.created_at
      from public.despesas d where d.criado_por = p_user and d.excluido_em is null
    union all
    select 'saude_registros', s.id, (s.tipo || ' — ' || a.nome)::text, s.created_at
      from public.saude_registros s join public.animais a on a.id = s.animal_id
     where s.criado_por = p_user and s.excluido_em is null
    union all
    select 'reproducao', r.id, (r.tipo || ' — ' || a.nome)::text, r.created_at
      from public.reproducao r join public.animais a on a.id = r.animal_id
     where r.criado_por = p_user and r.excluido_em is null
    union all
    select 'pesagens', p.id, (p.peso || ' kg — ' || a.nome)::text, p.created_at
      from public.pesagens p join public.animais a on a.id = p.animal_id
     where p.criado_por = p_user and p.excluido_em is null
    union all
    select 'anotacoes', n.id, ('Anotação — ' || a.nome)::text, n.created_at
      from public.anotacoes n join public.animais a on a.id = n.animal_id
     where n.criado_por = p_user and n.excluido_em is null
  ) t(tabela, id, descricao, quando) order by t.quando desc limit 1
$$;

/** Excluir/restaurar em nome de alguem, com a mesma checagem de papel. */
create or replace function public.agente_excluir(p_user uuid, p_tabela text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, p_tabela = 'despesas');
begin
  if not public.tabela_reversivel(p_tabela) then
    raise exception 'Tabela não permitida.';
  end if;
  execute format(
    'update public.%I set excluido_em = now() where id = $1 and haras_id = $2', p_tabela)
    using p_id, v_haras;
end $$;

create or replace function public.agente_restaurar(p_user uuid, p_tabela text, p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, p_tabela = 'despesas');
begin
  if not public.tabela_reversivel(p_tabela) then
    raise exception 'Tabela não permitida.';
  end if;
  execute format(
    'update public.%I set excluido_em = null where id = $1 and haras_id = $2', p_tabela)
    using p_id, v_haras;
end $$;

-- ---------------------------------------------------------- resumo diario

/*
  O que cada pessoa precisa saber hoje de manha.

  Uma linha por membro com telefone confirmado, de haras com WhatsApp
  conectado. Quem nao confirmou o numero nao recebe — mandar mensagem para
  numero nao provado e o caminho mais curto para o banimento.

  O conteudo respeita o papel: peao nao recebe o bloco de dinheiro.
*/
create or replace function public.resumo_diario()
returns table (instancia text, telefone text, mensagem text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  return query
  with pendencias as (
    select s.haras_id, a.nome, s.tipo, s.proxima_data
    from public.saude_registros s
    join public.animais a on a.id = s.animal_id
    where s.excluido_em is null and s.proxima_data is not null
      and s.proxima_data <= current_date + 7
  ),
  partos as (
    select r.haras_id, a.nome, r.data_prevista_parto
    from public.reproducao r
    join public.animais a on a.id = r.animal_id
    where r.excluido_em is null and r.cria_id is null
      and r.data_prevista_parto between current_date - 15 and current_date + 15
  ),
  gasto as (
    select d.haras_id, sum(d.valor) as total
    from public.despesas d
    where d.excluido_em is null
      and d.data >= date_trunc('month', current_date)
    group by d.haras_id
  )
  select
    public.instancia_whatsapp(h.id),
    m.telefone,
    concat_ws(chr(10) || chr(10),
      '☀️ *Bom dia!* Hoje no ' || h.nome || ':',
      (select string_agg('💉 *' || p.nome || '* — ' || p.tipo ||
                         case when p.proxima_data < current_date then ' (atrasado)'
                              when p.proxima_data = current_date then ' (hoje)'
                              else ' em ' || (p.proxima_data - current_date) || ' dias' end,
                         chr(10))
         from pendencias p where p.haras_id = h.id),
      (select string_agg('🍼 *' || t.nome || '* — parto ' ||
                         case when t.data_prevista_parto < current_date
                              then 'previsto há ' || (current_date - t.data_prevista_parto) || ' dias'
                              else 'em ' || (t.data_prevista_parto - current_date) || ' dias' end,
                         chr(10))
         from partos t where t.haras_id = h.id),
      case when m.papel in ('dono', 'gerente') then
        (select '💰 Gasto do mês: R$ ' || to_char(g.total, 'FM999G999D00')
           from gasto g where g.haras_id = h.id)
      end
    )
  from public.membros m
  join public.haras h on h.id = m.haras_id
  where m.telefone is not null
    and m.telefone_verificado_em is not null
    and h.whatsapp_conectado_em is not null
    and h.status_conta in ('trial', 'ativa')
    -- Só manda se houver algo além do cabeçalho.
    and (exists (select 1 from pendencias p where p.haras_id = h.id)
         or exists (select 1 from partos t where t.haras_id = h.id));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'agente_ficha_animal(uuid, uuid)',
    'agente_lancar_anotacao(uuid, uuid, text, text, date)',
    'agente_lancar_evento(uuid, text, text, date, uuid, text)',
    'agente_lancar_sanidade_lote(uuid, uuid[], text, text, date, date, numeric, text)',
    'agente_ultimo_lancamento(uuid)',
    'agente_excluir(uuid, text, uuid)',
    'agente_restaurar(uuid, text, uuid)',
    'resumo_diario()'
  ] loop
    execute format('revoke execute on function public.%s from anon, authenticated, public', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
