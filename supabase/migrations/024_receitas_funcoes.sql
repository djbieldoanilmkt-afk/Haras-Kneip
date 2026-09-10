-- 024 — Funções de receita: gravar, somar e lançar por voz.

begin;

/*
  Gravar receita pela tela.

  Espelha `criar_despesa`: `security definer` para conferir papel e haras uma
  vez só, em vez de deixar cada política de RLS repetir a checagem.
*/
create or replace function public.criar_receita(
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_cliente text default null,
  p_animal uuid default null,
  p_forma_pagamento text default null,
  p_observacoes text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_id uuid;
begin
  if v_haras is null then
    raise exception 'Usuário sem haras.';
  end if;
  if not public.ve_financeiro() then
    raise exception 'Seu papel não tem acesso ao financeiro.';
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'A conta deste haras não permite lançamentos agora.';
  end if;
  if coalesce(p_valor, -1) < 0 then
    raise exception 'Informe um valor válido.';
  end if;

  -- Animal de outro haras não entra: seria um vínculo entre inquilinos.
  if p_animal is not null and not exists (
    select 1 from public.animais where id = p_animal and haras_id = v_haras
  ) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  insert into public.receitas
    (haras_id, data, categoria, descricao, valor, cliente, animal_id,
     forma_pagamento, observacoes, criado_por, origem)
  values
    (v_haras, coalesce(p_data, current_date), p_categoria, p_descricao, p_valor,
     nullif(trim(coalesce(p_cliente, '')), ''), p_animal,
     nullif(trim(coalesce(p_forma_pagamento, '')), ''),
     nullif(trim(coalesce(p_observacoes, '')), ''), auth.uid(), 'app')
  returning id into v_id;

  return v_id;
end $$;

/*
  Entrou, saiu, sobrou.

  Numa consulta só, porque a tela mostra os três juntos e três idas ao banco
  para o mesmo período abrem espaço para responderem de intervalos diferentes.
*/
create or replace function public.resumo_financeiro(
  p_desde date default null,
  p_ate date default null
)
returns table (receitas numeric, despesas numeric, saldo numeric)
language sql stable security definer
set search_path = public
as $$
  select
    coalesce(r.total, 0) as receitas,
    coalesce(d.total, 0) as despesas,
    coalesce(r.total, 0) - coalesce(d.total, 0) as saldo
  from
    (select sum(valor) as total from public.receitas
      where haras_id = public.meu_haras_id() and excluido_em is null
        and (p_desde is null or data >= p_desde)
        and (p_ate is null or data <= p_ate)
        and public.ve_financeiro()) r,
    (select sum(valor) as total from public.despesas
      where haras_id = public.meu_haras_id() and excluido_em is null
        and (p_desde is null or data >= p_desde)
        and (p_ate is null or data <= p_ate)
        and public.ve_financeiro()) d
$$;

-- ----------------------------------------------------------- pelo agente

create or replace function public.agente_lancar_receita(
  p_user uuid,
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_cliente text default null,
  p_animal uuid default null,
  p_forma_pagamento text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.agente_pode_escrever(p_user, true);
  v_categoria text;
  v_id uuid;
begin
  /*
    A fala vira categoria da lista fechada.

    Quem lança por voz diz "vendi a Aurora", não "categoria Venda de animal".
    Traduzir aqui — e não só no prompt — mantém a lista fechada do lado do
    banco: palavra fora da lista vira 'Outros', não violação de restrição no
    meio de uma conversa de WhatsApp.
  */
  v_categoria := case
    when p_categoria ilike '%vend%' or p_categoria ilike '%venda%' then 'Venda de animal'
    when p_categoria ilike '%cobert%' or p_categoria ilike '%cobr%' then 'Cobertura'
    when p_categoria ilike '%hosped%' or p_categoria ilike '%pens%' then 'Hospedagem'
    when p_categoria ilike '%servi%' or p_categoria ilike '%doma%' or p_categoria ilike '%trein%'
      then 'Prestação de serviço'
    when p_categoria ilike '%prem%' or p_categoria ilike '%prêm%' then 'Premiação'
    when p_categoria ilike '%alug%' then 'Aluguel'
    else 'Outros'
  end;

  if p_animal is not null and not exists (
    select 1 from public.animais where id = p_animal and haras_id = v_haras
  ) then
    raise exception 'Animal não encontrado neste haras.';
  end if;

  insert into public.receitas
    (haras_id, data, categoria, descricao, valor, cliente, animal_id,
     forma_pagamento, criado_por, origem)
  values
    (v_haras, coalesce(p_data, current_date), v_categoria,
     coalesce(nullif(trim(p_descricao), ''), v_categoria), p_valor,
     nullif(trim(coalesce(p_cliente, '')), ''), p_animal,
     nullif(trim(coalesce(p_forma_pagamento, '')), ''), p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.agente_consulta_receitas(
  p_user uuid,
  p_animal uuid default null,
  p_desde date default null,
  p_ate date default null,
  p_termo text default null
)
returns table (data date, categoria text, descricao text, valor numeric, cliente text, animal text)
language sql stable security definer
set search_path = public
as $$
  select r.data, r.categoria, r.descricao, r.valor, r.cliente, a.nome
  from public.receitas r
  join public.membros m on m.haras_id = r.haras_id
  left join public.animais a on a.id = r.animal_id
  where m.user_id = p_user
    and m.papel in ('dono', 'gerente')
    and r.excluido_em is null
    and (p_animal is null or r.animal_id = p_animal)
    and (p_desde is null or r.data >= p_desde)
    and (p_ate is null or r.data <= p_ate)
    and (p_termo is null or r.descricao ilike '%' || p_termo || '%'
         or r.categoria ilike '%' || p_termo || '%')
  order by r.data desc
$$;

/*
  Ficha do animal com os dois lados.

  Mostrar só "já custou" num animal que foi vendido por trinta mil conta
  metade da história — e é a metade que faz o animal parecer prejuízo.
*/
create or replace function public.agente_ficha_animal(p_user uuid, p_animal uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
  v_json json;
begin
  select haras_id, papel into v_haras, v_papel from public.membros where user_id = p_user;
  if v_haras is null then
    raise exception 'Usuário sem haras.';
  end if;

  select json_build_object(
    'nome', a.nome,
    'sexo', a.sexo,
    'pelagem', a.pelagem,
    'marcha', a.tipo_marcha,
    'nascimento', a.data_nascimento,
    'status', a.status_reprodutivo,
    'local', a.baia_piquete,
    'registro', a.registro_abccmm,
    'foto', a.foto_url,

    'peso', (select json_build_object('kg', p.peso, 'quando', p.data_pesagem)
               from public.pesagens p
              where p.animal_id = a.id and p.excluido_em is null
              order by p.data_pesagem desc limit 1),

    'proxima_sanidade', (select json_build_object('tipo', s.tipo, 'quando', s.proxima_data)
               from public.saude_registros s
              where s.animal_id = a.id and s.excluido_em is null
                and s.proxima_data is not null
              order by s.proxima_data limit 1),

    'pai', (select x.nome from public.genealogia g
              join public.animais x on x.id = g.pai_id where g.animal_id = a.id),
    'mae', (select x.nome from public.genealogia g
              join public.animais x on x.id = g.mae_id where g.animal_id = a.id),

    'custo_total', case when v_papel in ('dono', 'gerente') then (
        coalesce((select sum(s.custo) from public.saude_registros s
                   where s.animal_id = a.id and s.excluido_em is null), 0)
      + coalesce((select sum(r.valor) from public.despesa_rateios r
                   join public.despesas d on d.id = r.despesa_id
                  where r.animal_id = a.id and d.excluido_em is null), 0)
    ) end,

    'receita_total', case when v_papel in ('dono', 'gerente') then
        coalesce((select sum(rc.valor) from public.receitas rc
                   where rc.animal_id = a.id and rc.excluido_em is null), 0)
      end
  ) into v_json
  from public.animais a
  where a.id = p_animal and a.haras_id = v_haras;

  if v_json is null then
    raise exception 'Animal não encontrado neste haras.';
  end if;
  return v_json;
end $$;

/*
  Permissões: fecha tudo, depois abre o mínimo.

  A 021 fez função nova nascer sem execute para PUBLIC, mas quem lê esta
  migração sozinha não sabe disso — o `revoke` explícito deixa a intenção no
  arquivo, e não numa migração anterior.
*/
do $$
declare f text;
begin
  foreach f in array array[
    'criar_receita(date, text, text, numeric, text, uuid, text, text)',
    'resumo_financeiro(date, date)',
    'agente_lancar_receita(uuid, date, text, text, numeric, text, uuid, text)',
    'agente_consulta_receitas(uuid, uuid, date, date, text)',
    'agente_ficha_animal(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

/*
  A tela chama estas duas COMO a pessoa logada: as duas usam `auth.uid()` e
  `meu_haras_id()`, então rodar sob service_role devolveria nulo.
*/
grant execute on function public.criar_receita(date, text, text, numeric, text, uuid, text, text)
  to authenticated;
grant execute on function public.resumo_financeiro(date, date) to authenticated;

-- As do agente recebem o usuário por parâmetro e só a função de borda chama.
grant execute on function public.agente_lancar_receita(uuid, date, text, text, numeric, text, uuid, text)
  to service_role;
grant execute on function public.agente_consulta_receitas(uuid, uuid, date, date, text)
  to service_role;
grant execute on function public.agente_ficha_animal(uuid, uuid) to service_role;

commit;
