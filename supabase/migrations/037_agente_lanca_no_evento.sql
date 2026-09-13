-- 037 — O agente aloca a despesa no evento.
--
-- "Quando eu cadastrar um evento eu posso mandar um áudio dos meus gastos e
-- falar do que se trata o gasto, e você aloca certinho no meu painel?"
--
-- Hoje não. A 035 ligou despesa a evento e a 036 fez a TELA gravar isso, mas
-- `agente_lancar_despesa` não conhece evento nenhum: falar "gastei 800 de
-- carreto na Copa de Março" lançava a despesa solta. O gasto entrava, o
-- agrupamento não — e ninguém era avisado.
--
-- O NOME, E NÃO O ID
--
-- Quem fala diz "na Copa de Março", não um UUID. A busca é por semelhança no
-- título, e o evento mais PRÓXIMO da data do gasto ganha: "Copa de Março" de
-- 2026 e de 2027 têm o mesmo nome, e o carreto de hoje pertence à deste ano.
--
-- Sem achar, a despesa entra solta em vez de falhar: perder o agrupamento é
-- recuperável pela tela; perder o lançamento de quem está no meio do curral,
-- não.

begin;

/** Acha o evento pelo nome falado, preferindo o mais proximo da data. */
create or replace function public.evento_por_nome(
  p_haras uuid, p_nome text, p_perto_de date default null
)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select e.id
  from public.eventos e
  where e.haras_id = p_haras
    and e.excluido_em is null
    and nullif(btrim(coalesce(p_nome, '')), '') is not null
    and e.titulo ilike '%' || btrim(p_nome) || '%'
  order by abs(e.data_evento - coalesce(p_perto_de, current_date))
  limit 1
$$;

create or replace function public.agente_lancar_despesa(
  p_user uuid,
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_fornecedor text default null,
  p_animais uuid[] default null,
  p_evento text default null
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
  v_data date := coalesce(p_data, current_date);
  v_evento uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero.';
  end if;

  v_evento := public.evento_por_nome(v_haras, p_evento, v_data);

  insert into public.despesas
    (haras_id, data, categoria, descricao, valor, fornecedor, evento_id, criado_por, origem)
  values
    (v_haras, v_data, p_categoria, p_descricao, p_valor,
     nullif(trim(coalesce(p_fornecedor, '')), ''),
     v_evento, p_user, 'whatsapp')
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
    select v_id, a, v_haras,
           (v_base + case when i <= v_resto then 1 else 0 end) / 100.0
      from unnest(p_animais) with ordinality as t(a, i)
     where exists (select 1 from public.animais x where x.id = a and x.haras_id = v_haras);
  end if;

  return v_id;
end $$;

-- A versao de 7 parametros sai: mantida, o PostgREST teria duas candidatas.
drop function if exists public.agente_lancar_despesa(uuid, date, text, text, numeric, text, uuid[]);

revoke execute on function public.agente_lancar_despesa(uuid, date, text, text, numeric, text, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.agente_lancar_despesa(uuid, date, text, text, numeric, text, uuid[], text)
  to service_role;

revoke execute on function public.evento_por_nome(uuid, text, date) from public, anon, authenticated;
grant execute on function public.evento_por_nome(uuid, text, date) to service_role;

/** Os eventos que o agente pode citar, para entrarem no prompt. */
create or replace function public.agente_eventos(p_user uuid)
returns table (id uuid, titulo text, data_evento date, tipo text)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.titulo, e.data_evento, e.tipo
  from public.eventos e
  join public.membros m on m.haras_id = e.haras_id
  where m.user_id = p_user
    and e.excluido_em is null
    and e.data_evento between current_date - 365 and current_date + 180
  order by e.data_evento desc
$$;

revoke execute on function public.agente_eventos(uuid) from public, anon, authenticated;
grant execute on function public.agente_eventos(uuid) to service_role;

commit;
