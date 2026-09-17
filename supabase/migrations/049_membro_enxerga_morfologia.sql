-- 049 — O agente só oferece a morfologia a quem tem o módulo.
--
-- O módulo é exclusivo do Kneip. O banco já barra o uso: `morfologia_iniciar`
-- devolve "não está liberada" para quem não tem o recurso. Mas barrar o uso
-- não basta — se a ação estiver no prompt de todo mundo, o agente dos outros
-- haras vai OFERECER um recurso que eles não podem usar, e ficar explicando
-- que não dá. Um recurso exclusivo que todo mundo conhece deixou de ser
-- exclusivo.
--
-- A resposta vem junto de uma consulta que já acontece uma vez por mensagem,
-- para não custar uma ida a mais ao banco por WhatsApp recebido.

begin;

/* `create or replace` não muda a assinatura de função que devolve table. */
drop function if exists public.membro_por_telefone(text);

create function public.membro_por_telefone(p_numero text)
returns table (user_id uuid, haras_id uuid, papel text, voz text, morfologia boolean)
language sql stable security definer
set search_path = public
as $$
  select m.user_id, m.haras_id, m.papel, m.voz,
         public.pode_morfologia(m.user_id, 'criar')
  from public.membros m
  where m.telefone = public.normalizar_telefone(p_numero)
    and m.telefone_verificado_em is not null
$$;

revoke execute on function public.membro_por_telefone(text) from public, anon, authenticated;
grant execute on function public.membro_por_telefone(text) to service_role;

commit;
