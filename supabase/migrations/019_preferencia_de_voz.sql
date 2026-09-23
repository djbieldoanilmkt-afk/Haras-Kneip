-- 019 — Cada pessoa escolhe se quer ouvir o agente.
--
-- Três modos, porque o haras não tem um perfil só de gente:
--
--   auto   — responde falando para quem falou (padrão). Quem manda áudio está
--            de mão ocupada; quem digitou quer ler.
--   sempre — fala mesmo quando a pessoa digitou. Para quem enxerga mal ou
--            trabalha longe do escritório.
--   nunca  — nunca fala. Para quem está em reunião, sem fone, ou simplesmente
--            se irrita com áudio.
--
-- Fica por MEMBRO, não por haras: o gerente no computador e o tratador no
-- curral usam o mesmo sistema e não querem a mesma coisa.

begin;

alter table public.membros
  add column if not exists voz text not null default 'auto',
  add column if not exists ultima_resposta text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'membros_voz_check'
  ) then
    alter table public.membros
      add constraint membros_voz_check check (voz in ('auto', 'sempre', 'nunca'));
  end if;
end $$;

comment on column public.membros.voz is
  'auto | sempre | nunca — quando o agente responde falando.';
comment on column public.membros.ultima_resposta is
  'Ultima resposta enviada a esta pessoa, para o "repete em audio".';

-- `create or replace` nao muda o tipo de retorno de uma funcao que devolve
-- table; a assinatura de 008 tinha menos colunas.
drop function if exists public.membro_por_telefone(text);

create function public.membro_por_telefone(p_numero text)
returns table (user_id uuid, haras_id uuid, papel text, voz text)
language sql stable security definer
set search_path = public
as $$
  select m.user_id, m.haras_id, m.papel, m.voz
  from public.membros m
  where m.telefone = public.normalizar_telefone(p_numero)
    and m.telefone_verificado_em is not null
$$;

create or replace function public.agente_definir_voz(p_user uuid, p_modo text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_modo text;
begin
  /*
    Traduz a fala em modo.

    Quem pede isso diz "para de mandar audio", nao "modo nunca". Normalizar
    aqui, e nao so no prompt, mantem a lista fechada do lado do banco: uma
    palavra fora da lista vira erro de constraint em vez de virar dado.
  */
  v_modo := case
    when p_modo ilike any (array['nunca', 'nao', 'sem audio', 'desliga', 'off', 'texto'])
      then 'nunca'
    when p_modo ilike any (array['sempre', 'tudo', 'always', 'audio'])
      then 'sempre'
    else 'auto'
  end;

  update public.membros set voz = v_modo where user_id = p_user;
  if not found then
    raise exception 'Pessoa sem cadastro neste haras.';
  end if;
  return v_modo;
end $$;

/** Guarda a ultima resposta, para quem pedir "repete em audio". */
create or replace function public.agente_guardar_resposta(p_user uuid, p_texto text)
returns void
language sql security definer
set search_path = public
as $$
  update public.membros set ultima_resposta = p_texto where user_id = p_user;
$$;

create or replace function public.agente_ultima_resposta(p_user uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select ultima_resposta from public.membros where user_id = p_user;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'membro_por_telefone(text)',
    'agente_definir_voz(uuid, text)',
    'agente_guardar_resposta(uuid, text)',
    'agente_ultima_resposta(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from anon, authenticated, public', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
