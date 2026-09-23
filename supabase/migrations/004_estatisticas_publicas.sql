-- ============================================================================
-- Contador da landing: numeros agregados, legiveis sem login.
--
-- security definer porque o RLS (corretamente) impede o anonimo de ler as
-- linhas. A funcao devolve SO contagens — nenhum dado de nenhum haras vaza.
-- ============================================================================

create or replace function public.estatisticas_publicas()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'animais', (select count(*) from public.animais where ativo = true),
    'haras', (select count(*) from public.haras where status_conta in ('trial', 'ativa'))
  )
$$;

revoke all on function public.estatisticas_publicas() from public;
grant execute on function public.estatisticas_publicas() to anon, authenticated;
