-- 020 — A consulta de plantel entende como as pessoas falam.
--
-- Dois furos encontrados testando "quais éguas estão prenhas?", que devolvia
-- vazio num haras com uma égua prenha:
--
-- 1) PLURAL. O modelo repete a palavra da pessoa, e a pessoa diz "prenhas".
--    O filtro fazia `ilike '%prenhas%'` contra a coluna que guarda 'Prenha' —
--    o "s" a mais zerava o resultado. Consertar no prompt seria pedir para o
--    modelo nunca errar; consertar aqui vale para qualquer frase.
--
-- 2) SEXO não era filtro. "Éguas" só podia virar `termo`, que procura no NOME
--    do animal. Nenhuma égua se chama "égua", então dava zero.
--
-- Os dois falhavam do jeito mais perigoso: resposta vazia e confiante, que se
-- lê como "não tem nenhuma" em vez de "não entendi".

begin;

create or replace function public.normalizar_sexo(p_texto text)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_texto is null or btrim(p_texto) = '' then null
    when lower(btrim(p_texto)) ~ '^(f|femea|fêmea|femeas|fêmeas|egua|égua|eguas|éguas|potra|potras|matriz|matrizes)$'
      then 'Fêmea'
    when lower(btrim(p_texto)) ~ '^(m|macho|machos|garanhao|garanhão|garanhoes|garanhões|potro|potros|reprodutor|reprodutores|castrado)$'
      then 'Macho'
    else null
  end
$$;

/** Tira o plural para o `ilike` casar com o singular guardado na coluna. */
create or replace function public.singularizar(p_texto text)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_texto is null then null
    when length(btrim(p_texto)) > 3 and lower(btrim(p_texto)) like '%s'
      then left(btrim(p_texto), length(btrim(p_texto)) - 1)
    else btrim(p_texto)
  end
$$;

drop function if exists public.agente_consulta_animais(uuid, text, text, text);

create function public.agente_consulta_animais(
  p_user uuid,
  p_status text default null,
  p_local text default null,
  p_termo text default null,
  p_sexo text default null
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
    -- Externo e ancestral de arvore genealogica, nao animal do curral.
    and a.externo = false
    and (p_status is null
         or a.status_reprodutivo ilike '%' || public.singularizar(p_status) || '%')
    and (p_local is null or a.baia_piquete ilike '%' || p_local || '%')
    and (p_termo is null or a.nome ilike '%' || p_termo || '%')
    and (public.normalizar_sexo(p_sexo) is null
         or a.sexo = public.normalizar_sexo(p_sexo))
  order by a.nome
$$;

revoke execute on function public.agente_consulta_animais(uuid, text, text, text, text)
  from anon, authenticated, public;
grant execute on function public.agente_consulta_animais(uuid, text, text, text, text)
  to service_role;

commit;
