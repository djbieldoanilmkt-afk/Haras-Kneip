-- ============================================================================
-- GENEALOGIA SEM DEPENDER DA ABCCMM
-- Rode depois do 013_foto_pelo_agente.sql.
--
-- A arvore aponta para `animais` nas sete pontas (pai, mae e quatro avos).
-- Isso funcionava enquanto todo ancestral fosse do proprio plantel — e o
-- garanhao que cobriu a egua quase nunca e. Resultado no banco de hoje: nove
-- animais, dois com genealogia, e quatro coberturas com o nome do garanhao
-- guardado como texto solto que a arvore nao enxerga.
--
-- Duas frentes:
--
--   1. ANCESTRAL EXTERNO. Um animal marcado `externo` existe so para fechar a
--      arvore. Nao entra no plantel, nao conta nas estatisticas, nao aparece
--      na vitrine.
--
--   2. DERIVAR DO QUE JA ACONTECE. Parto com a cria informada ja diz quem e a
--      mae; se a linha trouxer o garanhao, diz o pai tambem. Metade da arvore
--      se preenche sem ninguem digitar.
-- ============================================================================

begin;

alter table public.animais add column if not exists externo boolean not null default false;

-- A busca do plantel sempre exclui externos; vale um indice parcial.
create index if not exists animais_plantel_idx
  on public.animais (haras_id) where ativo = true and externo = false;

/*
  A vitrine tambem exclui.

  `em_destaque` ja bastaria na pratica — ninguem marca um ancestral de fora
  como destaque —, mas depender disso seria contar com disciplina humana para
  nao vazar o garanhao de outro haras na pagina publica.
*/
drop policy if exists animais_vitrine on public.animais;
create policy animais_vitrine on public.animais for select to anon, authenticated
  using (
    em_destaque = true and ativo = true and externo = false
    and exists (select 1 from public.haras h
                where h.id = haras_id and h.status_conta in ('trial', 'ativa'))
  );

-- ------------------------------------------------- resolver um ancestral

/*
  Acha o ancestral pelo nome; se nao existir, cria como externo.

  Buscar em TODO o haras (inclusive entre externos ja criados) evita duplicar
  o mesmo garanhao a cada cobertura. A comparacao ignora caixa e espaco de
  sobra porque o nome vem de fala transcrita.
*/
create or replace function public.resolver_ancestral(
  p_haras uuid,
  p_nome text,
  p_sexo text,
  p_user uuid
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_id uuid;
begin
  if v_nome is null then
    return null;
  end if;

  select id into v_id
    from public.animais
   where haras_id = p_haras and lower(nome) = lower(v_nome)
   order by externo   -- prefere o do plantel a um externo homonimo
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.animais
    (haras_id, nome, sexo, raca, ativo, externo, criado_por, origem)
  values
    (p_haras, v_nome, p_sexo, 'Mangalarga Marchador', true, true, p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_definir_pais(
  p_user uuid,
  p_animal uuid,
  p_pai text default null,
  p_mae text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_pai uuid;
  v_mae uuid;
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  v_pai := public.resolver_ancestral(v_haras, p_pai, 'Macho', p_user);
  v_mae := public.resolver_ancestral(v_haras, p_mae, 'Fêmea', p_user);

  insert into public.genealogia (haras_id, animal_id, pai_id, mae_id, criado_por, origem)
  values (v_haras, p_animal, v_pai, v_mae, p_user, 'whatsapp')
  on conflict (animal_id) do update
    -- coalesce: informar so o pai nao pode apagar a mae ja registrada.
    set pai_id = coalesce(excluded.pai_id, public.genealogia.pai_id),
        mae_id = coalesce(excluded.mae_id, public.genealogia.mae_id),
        updated_at = now();
end $$;

-- ------------------------------------- genealogia derivada do parto

/*
  Parto com a cria informada preenche a arvore sozinho.

  A egua do evento e a mae, por definicao. O garanhao, quando a linha traz,
  vira o pai — resolvido pelo nome, criado como externo se for de fora.

  Roda como gatilho e nao no aplicativo porque o parto pode ser lancado pela
  tela, pelo WhatsApp ou por importacao, e a arvore tem de sair igual nos tres.
*/
create or replace function public.genealogia_do_parto()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_pai uuid;
begin
  if new.cria_id is null or new.tipo <> 'Parto' then
    return new;
  end if;

  v_pai := public.resolver_ancestral(new.haras_id, new.garanhao, 'Macho', new.criado_por);

  insert into public.genealogia (haras_id, animal_id, pai_id, mae_id, criado_por, origem)
  values (new.haras_id, new.cria_id, v_pai, new.animal_id, new.criado_por,
          coalesce(new.origem, 'app'))
  on conflict (animal_id) do update
    set pai_id = coalesce(public.genealogia.pai_id, excluded.pai_id),
        mae_id = coalesce(public.genealogia.mae_id, excluded.mae_id),
        updated_at = now();

  return new;
end $$;

drop trigger if exists reproducao_genealogia on public.reproducao;
create trigger reproducao_genealogia
  after insert or update of cria_id on public.reproducao
  for each row execute function public.genealogia_do_parto();

-- ------------------------------------------- externos fora das listas

create or replace function public.agente_plantel(p_user uuid)
returns table (id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.nome
  from public.animais a
  join public.membros m on m.haras_id = a.haras_id
  where m.user_id = p_user and a.ativo = true and a.externo = false
  order by a.nome
$$;

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
    and a.externo = false
    and (p_status is null or a.status_reprodutivo ilike '%' || p_status || '%')
    and (p_local is null or a.baia_piquete ilike '%' || p_local || '%')
    and (p_termo is null or a.nome ilike '%' || p_termo || '%')
  order by a.nome
$$;

create or replace function public.estatisticas_publicas()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'animais', (select count(*) from public.animais
                where ativo = true and externo = false),
    'haras', (select count(*) from public.haras where status_conta in ('trial', 'ativa'))
  )
$$;

grant execute on function public.resolver_ancestral(uuid, text, text, uuid) to service_role;
revoke execute on function public.agente_definir_pais(uuid, uuid, text, text)
  from anon, authenticated, public;
grant execute on function public.agente_definir_pais(uuid, uuid, text, text) to service_role;

commit;
