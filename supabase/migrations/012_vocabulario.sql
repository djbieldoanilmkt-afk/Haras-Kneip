-- ============================================================================
-- VOCABULARIO: ALINHA O QUE A TELA OFERECE COM O QUE O BANCO ACEITA
-- Rode depois do 011_agente.sql.
--
-- BUG DE PRODUCAO. As listas de src/lib/status.ts e os check constraints
-- divergiam, e quase nao se encontravam:
--
--   a tela oferecia   'Vacina'      -> o banco exigia 'Vacinação'
--   a tela oferecia   'Vermífugo'   -> o banco exigia 'Vermifugação'
--   a tela oferecia   'Odontologia' -> o banco nao aceitava
--
-- Ou seja: escolher a PRIMEIRA opcao do formulario de sanidade estourava com
-- violacao de constraint. Cinco dos seis tipos de reproducao idem. So o
-- calendario estava alinhado.
--
-- Conferido no banco: `insert ... tipo = 'Vacina'` -> 23514.
--
-- Aqui o banco e alargado para o vocabulario que as telas usam. Alargar, e
-- nao trocar: os valores ja gravados (Vacinação, Ferração, Cobertura...)
-- continuam validos. src/lib/status.ts passa a espelhar exatamente estas
-- listas.
-- ============================================================================

begin;

alter table public.saude_registros drop constraint if exists saude_registros_tipo_check;
alter table public.saude_registros add constraint saude_registros_tipo_check
  check (tipo in (
    'Vacinação', 'Vermifugação', 'Exame', 'Ferração',
    'Odontologia', 'Veterinário', 'Cirurgia/Tratamento', 'Outro'
  ));

alter table public.reproducao drop constraint if exists reproducao_tipo_check;
alter table public.reproducao add constraint reproducao_tipo_check
  check (tipo in (
    'Cobertura', 'Diagnóstico de Gestação', 'Gestação',
    'Parto', 'Desmame', 'Cio', 'Aborto'
  ));

-- --------------------------------------------- traducao do que se fala

/*
  No curral ninguem diz "Vermifugação".

  O modelo transcreve o que ouviu, e o que ouviu e "vermifuguei", "dei
  vermifugo", "vacinei". Recusar por causa da forma da palavra seria transformar
  um detalhe de digitacao em erro de sistema. O que nao encaixa vira 'Outro' —
  registrar com o rotulo generico e melhor que perder o lancamento.
*/
create or replace function public.normalizar_tipo_saude(p_tipo text)
returns text
language sql immutable
as $$
  select case
    when p_tipo ilike '%vacin%' then 'Vacinação'
    when p_tipo ilike '%vermifug%' or p_tipo ilike '%verm%' then 'Vermifugação'
    when p_tipo ilike '%exame%' or p_tipo ilike '%aie%' or p_tipo ilike '%mormo%' then 'Exame'
    when p_tipo ilike '%ferra%' or p_tipo ilike '%casco%' then 'Ferração'
    when p_tipo ilike '%dent%' or p_tipo ilike '%odonto%' then 'Odontologia'
    when p_tipo ilike '%cirurg%' or p_tipo ilike '%tratamento%' then 'Cirurgia/Tratamento'
    when p_tipo ilike '%veterin%' then 'Veterinário'
    else 'Outro'
  end
$$;

/*
  Idem para reproducao. Aqui o padrao NAO e generico: se nao der para saber se
  foi cobertura, parto ou desmame, gravar qualquer coisa distorce o indice
  reprodutivo. Devolve null e quem chamou pergunta.
*/
create or replace function public.normalizar_tipo_reproducao(p_tipo text)
returns text
language sql immutable
as $$
  select case
    when p_tipo ilike '%cobr%' or p_tipo ilike '%cobert%'
      or p_tipo ilike '%insemin%' or p_tipo ilike '%monta%' then 'Cobertura'
    when p_tipo ilike '%diagn%' or p_tipo ilike '%dg%' or p_tipo ilike '%prenh%' then 'Diagnóstico de Gestação'
    when p_tipo ilike '%gesta%' then 'Gestação'
    when p_tipo ilike '%part%' or p_tipo ilike '%nasce%' then 'Parto'
    when p_tipo ilike '%desmam%' then 'Desmame'
    when p_tipo ilike '%cio%' then 'Cio'
    when p_tipo ilike '%abort%' or p_tipo ilike '%absor%' then 'Aborto'
    else null
  end
$$;

create or replace function public.normalizar_metodo_reproducao(p_metodo text)
returns text
language sql immutable
as $$
  select case
    when p_metodo is null or trim(p_metodo) = '' then null
    when p_metodo ilike '%natural%' or p_metodo ilike '%monta%' then 'Monta Natural'
    when p_metodo ilike '%insemin%' or p_metodo ilike '%ia%' then 'Inseminação Artificial'
    when p_metodo ilike '%embri%' or p_metodo ilike '%te%' then 'Transferência de Embrião'
    else null
  end
$$;

-- As funcoes do agente passam a traduzir antes de gravar.

create or replace function public.agente_lancar_sanidade(
  p_user uuid,
  p_animal uuid,
  p_tipo text,
  p_descricao text,
  p_data date default null,
  p_proxima_data date default null,
  p_custo numeric default null,
  p_veterinario text default null
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

  insert into public.saude_registros
    (haras_id, animal_id, tipo, descricao, data_registro, proxima_data, custo,
     veterinario, criado_por, origem)
  values
    (v_haras, p_animal, public.normalizar_tipo_saude(p_tipo), coalesce(p_descricao, ''),
     coalesce(p_data, current_date), p_proxima_data, p_custo,
     nullif(trim(coalesce(p_veterinario, '')), ''), p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_lancar_reproducao(
  p_user uuid,
  p_animal uuid,
  p_tipo text,
  p_data date default null,
  p_garanhao text default null,
  p_metodo text default null,
  p_data_prevista_parto date default null,
  p_resultado text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, false);
  v_id uuid;
  v_data date := coalesce(p_data, current_date);
  v_parto date := p_data_prevista_parto;
  v_tipo text := public.normalizar_tipo_reproducao(p_tipo);
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;
  if v_tipo is null then
    raise exception 'Não entendi o tipo do evento (recebi "%"). Foi cobertura, diagnóstico, parto, desmame, cio ou aborto?', p_tipo;
  end if;

  -- Gestação de equino: ~340 dias. Sem esta conta o parto não entra no painel.
  if v_parto is null and v_tipo = 'Cobertura' then
    v_parto := v_data + 340;
  end if;

  insert into public.reproducao
    (haras_id, animal_id, tipo, data_evento, garanhao, metodo,
     data_prevista_parto, resultado, criado_por, origem)
  values
    (v_haras, p_animal, v_tipo, v_data,
     nullif(trim(coalesce(p_garanhao, '')), ''),
     public.normalizar_metodo_reproducao(p_metodo),
     v_parto,
     nullif(trim(coalesce(p_resultado, '')), ''),
     p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.normalizar_tipo_saude(text) to authenticated, service_role;
grant execute on function public.normalizar_tipo_reproducao(text) to authenticated, service_role;
grant execute on function public.normalizar_metodo_reproducao(text) to authenticated, service_role;

commit;
