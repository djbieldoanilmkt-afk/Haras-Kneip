-- 018 — O plantel que o agente enxerga.
--
-- Duas correções na relação que vai no prompt do modelo.
--
-- 1) Fora os externos. Desde a 014, um ancestral de outro haras vira uma linha
--    em `animais` só para sustentar a árvore genealógica. Ele é um nome, não um
--    animal do curral: não se vacina, não se pesa. Ele estava aparecendo na
--    lista que o modelo escolhe, então "vacina todo mundo" alcançaria avós
--    mortos de outro estado.
--
-- 2) Entram sexo e status. Sem eles o modelo não tem como transformar "as
--    éguas" ou "as prenhas" numa lista de ids — e a única saída dele seria
--    adivinhar pelo nome.

begin;

drop function if exists public.agente_plantel(uuid);

create function public.agente_plantel(p_user uuid)
returns table (id uuid, nome text, sexo text, status text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.nome, a.sexo, a.status_reprodutivo
  from public.animais a
  join public.membros m on m.haras_id = a.haras_id
  where m.user_id = p_user
    and a.ativo = true
    and a.externo = false
  order by a.nome
$$;

revoke execute on function public.agente_plantel(uuid) from anon, authenticated, public;
grant execute on function public.agente_plantel(uuid) to service_role;

commit;
