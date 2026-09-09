-- ============================================================================
-- EQUIPE: PLANO NA CONTA, CONVITE E PAPEIS
-- Rode depois do 006_fundacao_agente.sql.
--
-- A tabela de precos ja vendia "1 usuario", "ate 3 usuarios" e "usuarios
-- ilimitados", mas nada disso era cumpri­vel: a tabela `haras` nao guardava o
-- plano, e `membros` nao tinha INSERT para authenticated — ou seja, nao havia
-- caminho nenhum para uma segunda pessoa entrar na conta.
--
-- O limite conta PESSOAS, e nao numeros de telefone. Cada membro tem o seu
-- numero (006), e e isso que faz o `criado_por` significar alguma coisa: tres
-- pessoas compartilhando um login gravariam tudo como o mesmo autor, e a
-- trilha de autoria que acabamos de criar nao valeria nada.
-- ============================================================================

begin;

-- ------------------------------------------------------------------ plano

alter table public.haras add column if not exists plano text not null default 'essencial';

alter table public.haras drop constraint if exists haras_plano_valido;
alter table public.haras add constraint haras_plano_valido
  check (plano in ('essencial', 'haras', 'plantel'));

-- O dono NAO pode editar o proprio plano: seria se promover de graca. Fica
-- fora do grant por coluna, como status_conta e trial_expira_em ja ficam.
-- (o grant vigente e apenas em nome e logo_url; nada a fazer aqui)

/*
  Espelha src/lib/planos.ts. null = ilimitado.

  Duplicar o numero entre o banco e o front e proposital: o front usa para
  avisar antes de tentar, e o banco usa para recusar de fato. Se so o front
  soubesse, bastaria chamar a API direto para furar o limite.
*/
create or replace function public.limite_usuarios(p_plano text)
returns int
language sql immutable
as $$
  select case p_plano
    when 'essencial' then 1
    when 'haras' then 3
    else null
  end
$$;

-- ----------------------------------------------------------------- papeis

alter table public.membros drop constraint if exists membros_papel_valido;
alter table public.membros add constraint membros_papel_valido
  check (papel in ('dono', 'gerente', 'peao'));

create or replace function public.sou_dono()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros
    where user_id = auth.uid() and papel = 'dono'
  )
$$;

-- --------------------------------------------------------------- convites

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  haras_id uuid not null references public.haras(id) on delete cascade,
  -- Guardado em minusculas: e-mail nao diferencia caixa na pratica, e
  -- "Joao@x.com" e "joao@x.com" precisam colidir no indice de pendentes.
  email text not null,
  papel text not null default 'peao' check (papel in ('gerente', 'peao')),
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  aceito_em timestamptz
);

-- Um convite pendente por e-mail por haras. Aceitos ficam de fora do indice
-- para que a mesma pessoa possa ser reconvidada depois de sair.
create unique index if not exists convites_pendentes_idx
  on public.convites (haras_id, email)
  where aceito_em is null;

alter table public.convites enable row level security;

-- O haras enxerga os proprios convites. O convidado NAO entra por politica:
-- ele ainda nao e membro, entao meu_haras_id() e nulo para ele. Ele usa a
-- funcao meus_convites(), abaixo.
drop policy if exists convites_sel on public.convites;
create policy convites_sel on public.convites for select to authenticated
  using (haras_id = public.meu_haras_id());

-- Escrita so pelas funcoes. Sem grant, um insert direto nao passa nem que a
-- politica deixasse.
revoke insert, update, delete on public.convites from anon, authenticated;

-- ------------------------------------------------------------------ RPCs

create or replace function public.convidar_membro(p_email text, p_papel text default 'peao')
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_plano text;
  v_limite int;
  v_ocupados int;
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  if not public.sou_dono() then
    raise exception 'Só o dono da conta pode convidar.';
  end if;
  if p_papel not in ('gerente', 'peao') then
    raise exception 'Papel inválido.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;

  select plano into v_plano from public.haras where id = v_haras;
  v_limite := public.limite_usuarios(v_plano);

  -- Convite pendente ja ocupa vaga. Sem isso daria para convidar cinco
  -- pessoas num plano de tres e estourar o limite na hora que aceitassem.
  select
    (select count(*) from public.membros where haras_id = v_haras)
    + (select count(*) from public.convites
       where haras_id = v_haras and aceito_em is null)
  into v_ocupados;

  if v_limite is not null and v_ocupados >= v_limite then
    raise exception 'O plano atual permite % usuário(s). Mude de plano para incluir mais gente.', v_limite;
  end if;

  if exists (
    select 1 from public.membros m
    join auth.users u on u.id = m.user_id
    where m.haras_id = v_haras and lower(u.email) = v_email
  ) then
    raise exception 'Esta pessoa já faz parte da equipe.';
  end if;

  insert into public.convites (haras_id, email, papel, criado_por)
  values (v_haras, v_email, p_papel, auth.uid())
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe um convite pendente para este e-mail.';
end $$;

/** Convites pendentes para o e-mail de quem esta logado. */
create or replace function public.meus_convites()
returns table (id uuid, haras_nome text, papel text)
language sql stable security definer
set search_path = public
as $$
  select c.id, h.nome, c.papel
  from public.convites c
  join public.haras h on h.id = c.haras_id
  join auth.users u on lower(u.email) = c.email
  where u.id = auth.uid() and c.aceito_em is null
  order by c.created_at
$$;

create or replace function public.aceitar_convite(p_convite uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
  v_limite int;
  v_membros int;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Este usuário já pertence a um haras.';
  end if;

  select c.haras_id, c.papel into v_haras, v_papel
  from public.convites c
  join auth.users u on lower(u.email) = c.email
  where c.id = p_convite and c.aceito_em is null and u.id = auth.uid();

  if v_haras is null then
    raise exception 'Convite não encontrado ou já usado.';
  end if;

  -- Confere o limite DE NOVO na hora de aceitar: entre convidar e aceitar o
  -- haras pode ter trocado para um plano menor.
  select public.limite_usuarios(h.plano) into v_limite
  from public.haras h where h.id = v_haras;
  select count(*) into v_membros from public.membros where haras_id = v_haras;

  if v_limite is not null and v_membros >= v_limite then
    raise exception 'A equipe deste haras está cheia para o plano atual.';
  end if;

  insert into public.membros (haras_id, user_id, papel)
  values (v_haras, auth.uid(), v_papel);

  update public.convites set aceito_em = now() where id = p_convite;

  return v_haras;
end $$;

create or replace function public.remover_membro(p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
begin
  if v_haras is null or not public.sou_dono() then
    raise exception 'Só o dono da conta pode remover alguém.';
  end if;
  if p_user = auth.uid() then
    -- Sem isto o dono se removeria e a conta ficaria sem ninguem que possa
    -- convidar — orfa, e so recuperavel por dentro do banco.
    raise exception 'Você não pode remover a si mesmo.';
  end if;

  delete from public.membros where haras_id = v_haras and user_id = p_user;
end $$;

create or replace function public.cancelar_convite(p_convite uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.sou_dono() then
    raise exception 'Só o dono da conta pode cancelar convites.';
  end if;

  delete from public.convites
  where id = p_convite and haras_id = public.meu_haras_id() and aceito_em is null;
end $$;

/** Equipe do haras, com e-mail — que vive em auth.users, fora do alcance do RLS. */
create or replace function public.minha_equipe()
returns table (user_id uuid, email text, papel text, telefone text, desde timestamptz)
language sql stable security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.papel, m.telefone, m.created_at
  from public.membros m
  join auth.users u on u.id = m.user_id
  where m.haras_id = public.meu_haras_id()
  order by (m.papel = 'dono') desc, u.email
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'convidar_membro(text, text)', 'meus_convites()', 'aceitar_convite(uuid)',
    'remover_membro(uuid)', 'cancelar_convite(uuid)', 'minha_equipe()',
    'limite_usuarios(text)', 'sou_dono()'
  ] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

commit;
