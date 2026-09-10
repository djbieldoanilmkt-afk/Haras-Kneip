-- ============================================================================
-- FOTO DO ANIMAL ENVIADA PELO WHATSAPP
-- Rode depois do 012_vocabulario.sql.
--
-- O bucket `fotos-animais` ja existe desde 003_storage.sql, publico e com
-- escrita restrita a pasta do proprio haras. O agente sobe o arquivo com
-- service_role (que passa por cima do RLS) e grava a URL por aqui, para a
-- checagem de papel e haras acontecer no mesmo lugar das outras escritas.
-- ============================================================================

begin;

create or replace function public.agente_definir_foto(
  p_user uuid,
  p_animal uuid,
  p_url text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  update public.animais set foto_url = p_url where id = p_animal;
end $$;

revoke execute on function public.agente_definir_foto(uuid, uuid, text)
  from anon, authenticated, public;
grant execute on function public.agente_definir_foto(uuid, uuid, text) to service_role;

/*
  Ultimo animal cadastrado por esta pessoa, nos ultimos minutos.

  Serve para a foto mandada logo depois do cadastro cair no animal certo sem
  perguntar. Janela curta: foto solta meia hora depois provavelmente e de
  outro bicho, e errar o dono da foto e pior do que perguntar.
*/
create or replace function public.agente_ultimo_animal(p_user uuid, p_minutos int default 10)
returns table (id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.nome
  from public.animais a
  where a.criado_por = p_user
    and a.ativo = true
    and a.created_at > now() - make_interval(mins => p_minutos)
  order by a.created_at desc
  limit 1
$$;

revoke execute on function public.agente_ultimo_animal(uuid, int) from anon, authenticated, public;
grant execute on function public.agente_ultimo_animal(uuid, int) to service_role;

commit;
