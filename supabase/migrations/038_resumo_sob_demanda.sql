-- 038 — "Como está o haras?"
--
-- O resumo das 6h30 chega sozinho e olha para a FRENTE: o que vence, o que
-- está atrasado. Falta o contrário — alguém perguntar a qualquer hora "o que
-- andou acontecendo por aí?" e ouvir o que JÁ FOI FEITO.
--
-- É a pergunta de quem passou o dia fora, ou de quem chega na segunda e quer
-- saber o que a equipe lançou no fim de semana.
--
-- Dinheiro só para quem pode ver: o peão recebe o mesmo resumo sem as linhas
-- de caixa, em vez de um resumo recusado.

begin;

/*
  Dinheiro em portugues.

  O banco roda com lc_numeric = en_US.UTF-8, entao `to_char(v,'FM999G999D00')`
  devolve "4,870.00" -- formato americano. O resumo matinal vinha mandando
  assim para o celular do dono desde que foi ao ar.

  `,` e `.` no PADRAO do to_char sao literais, independentes de locale: dai a
  troca ser deterministica em qualquer servidor. Nao uso G nem D justamente
  para nao depender do locale de novo.
*/
create or replace function public.reais(p_valor numeric)
returns text
language sql immutable
as $$
  select 'R$ ' || replace(replace(replace(
           to_char(coalesce(p_valor, 0), 'FM999,999,990.00'),
         ',', '@'), '.', ','), '@', '.')
$$;

grant execute on function public.reais(numeric) to authenticated, service_role;

/** "1 dia" / "3 dias". Plural fixo e o tipo de detalhe que denuncia robo. */
create or replace function public.dias(p_n int)
returns text
language sql immutable
as $$
  select p_n || case when abs(p_n) = 1 then ' dia' else ' dias' end
$$;

grant execute on function public.dias(int) to authenticated, service_role;

/*
  O MESMO defeito de moeda estava no resumo matinal (016).

  `to_char(v,'FM999G999D00')` com lc_numeric en_US devolve "4,870.00". O
  gasto do mes vinha assim no WhatsApp do dono desde que o resumo foi ao ar.
  Corrijo aqui porque foi aqui que descobri, e as duas funcoes sao a mesma
  ideia -- resumo do haras.
*/
create or replace function public.resumo_diario()
returns table (instancia text, telefone text, mensagem text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  return query
  with pendencias as (
    select s.haras_id, a.nome, s.tipo, s.proxima_data
    from public.saude_registros s
    join public.animais a on a.id = s.animal_id
    where s.excluido_em is null and s.proxima_data is not null
      and s.proxima_data <= current_date + 7
  ),
  partos as (
    select r.haras_id, a.nome, r.data_prevista_parto
    from public.reproducao r
    join public.animais a on a.id = r.animal_id
    where r.excluido_em is null and r.cria_id is null
      and r.data_prevista_parto between current_date - 15 and current_date + 15
  ),
  gasto as (
    select d.haras_id, sum(d.valor) as total
    from public.despesas d
    where d.excluido_em is null
      and d.data >= date_trunc('month', current_date)
    group by d.haras_id
  )
  select
    public.instancia_whatsapp(h.id),
    m.telefone,
    concat_ws(chr(10) || chr(10),
      '☀️ *Bom dia!* Hoje no ' || h.nome || ':',
      (select string_agg('💉 *' || p.nome || '* — ' || p.tipo ||
                         case when p.proxima_data < current_date
                              then ' (atrasado ' || public.dias(current_date - p.proxima_data) || ')'
                              when p.proxima_data = current_date then ' (hoje)'
                              else ' em ' || public.dias(p.proxima_data - current_date) end,
                         chr(10))
         from pendencias p where p.haras_id = h.id),
      (select string_agg('🍼 *' || t.nome || '* — parto ' ||
                         case when t.data_prevista_parto < current_date
                              then 'previsto há ' || public.dias(current_date - t.data_prevista_parto)
                              else 'em ' || public.dias(t.data_prevista_parto - current_date) end,
                         chr(10))
         from partos t where t.haras_id = h.id),
      case when m.papel in ('dono', 'gerente') then
        (select '💰 Gasto do mês: ' || public.reais(g.total)
           from gasto g where g.haras_id = h.id)
      end
    )
  from public.membros m
  join public.haras h on h.id = m.haras_id
  where m.telefone is not null
    and m.telefone_verificado_em is not null
    and h.whatsapp_conectado_em is not null
    and h.status_conta in ('trial', 'ativa')
    and (m.resumo_enviado_em is null or m.resumo_enviado_em < current_date)
    and (exists (select 1 from pendencias p where p.haras_id = h.id)
         or exists (select 1 from partos t where t.haras_id = h.id));
end $$;

revoke execute on function public.resumo_diario() from public, anon, authenticated;
grant execute on function public.resumo_diario() to service_role;

create or replace function public.agente_resumo_geral(p_user uuid)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_papel text;
  v_nome text;
  v_fin boolean;
  partes text[] := '{}';
  bloco text;
  n_animais int; n_femeas int; n_machos int;
begin
  select m.haras_id, m.papel, h.nome into v_haras, v_papel, v_nome
  from public.membros m join public.haras h on h.id = m.haras_id
  where m.user_id = p_user;

  if v_haras is null then
    return 'Não achei seu haras. Confirme seu número em Configurações → Equipe.';
  end if;
  v_fin := v_papel in ('dono', 'gerente');

  select count(*),
         count(*) filter (where sexo = 'Fêmea'),
         count(*) filter (where sexo = 'Macho')
    into n_animais, n_femeas, n_machos
    from public.animais
   where haras_id = v_haras and ativo and not externo;

  partes := partes || ('📋 *Resumo do ' || v_nome || '*');
  partes := partes || ('🐴 ' || n_animais || ' animais — ' ||
                       n_femeas || case when n_femeas = 1 then ' fêmea' else ' fêmeas' end ||
                       ' e ' ||
                       n_machos || case when n_machos = 1 then ' macho' else ' machos' end);

  -- ----------------------------------------------- o que foi feito na semana
  --
  -- Cada linha so e GERADA se houver o que contar. A primeira versao montava
  -- tudo e tentava limpar os zeros com regexp depois -- nao funcionou, e mesmo
  -- que funcionasse seria consertar no fim o que e mais simples nao criar.
  -- Resumo cheio de "0 pesagens" esconde as linhas que importam.
  bloco := '';

  bloco := bloco || coalesce((
    select '💉 ' || count(*) || case when count(*) = 1 then ' registro de sanidade'
                                     else ' registros de sanidade' end || chr(10)
      from public.saude_registros
     where haras_id = v_haras and excluido_em is null
       and data_registro >= current_date - 7
    having count(*) > 0), '');

  bloco := bloco || coalesce((
    select '⚖️ ' || count(*) || case when count(*) = 1 then ' pesagem' else ' pesagens' end || chr(10)
      from public.pesagens
     where haras_id = v_haras and excluido_em is null
       and data_pesagem >= current_date - 7
    having count(*) > 0), '');

  bloco := bloco || coalesce((
    select '💕 ' || count(*) || case when count(*) = 1 then ' evento de reprodução'
                                     else ' eventos de reprodução' end || chr(10)
      from public.reproducao
     where haras_id = v_haras and excluido_em is null
       and data_evento >= current_date - 7
    having count(*) > 0), '');

  bloco := bloco || coalesce((
    select '📝 ' || count(*) || case when count(*) = 1 then ' anotação' else ' anotações' end || chr(10)
      from public.anotacoes
     where haras_id = v_haras and excluido_em is null
       and data_registro >= current_date - 7
    having count(*) > 0), '');

  if v_fin then
    bloco := bloco || coalesce((
      select '💰 ' || count(*) || case when count(*) = 1 then ' despesa, ' else ' despesas, ' end ||
             public.reais(sum(valor)) || chr(10)
        from public.despesas
       where haras_id = v_haras and excluido_em is null
         and data >= current_date - 7
      having count(*) > 0), '');

    bloco := bloco || coalesce((
      select '🟢 ' || count(*) || case when count(*) = 1 then ' receita, ' else ' receitas, ' end ||
             public.reais(sum(valor)) || chr(10)
        from public.receitas
       where haras_id = v_haras and excluido_em is null
         and data >= current_date - 7
      having count(*) > 0), '');
  end if;

  if btrim(bloco) <> '' then
    partes := partes || ('*Últimos 7 dias:*' || chr(10) || btrim(bloco, chr(10)));
  else
    partes := partes || '_Nenhum lançamento nos últimos 7 dias._';
  end if;

  -- --------------------------------------------------------------- atenção
  bloco := coalesce((
    select string_agg('💉 *' || a.nome || '* — ' || s.tipo ||
             case when s.proxima_data < current_date
                  then ' (atrasado ' || public.dias(current_date - s.proxima_data) || ')'
                  when s.proxima_data = current_date then ' (hoje)'
                  else ' em ' || public.dias(s.proxima_data - current_date) end, chr(10)
             order by s.proxima_data)
      from public.saude_registros s
      join public.animais a on a.id = s.animal_id
     where s.haras_id = v_haras and s.excluido_em is null
       and s.proxima_data is not null and s.proxima_data <= current_date + 15), '');

  bloco := bloco || coalesce((
    select case when bloco <> '' then chr(10) else '' end ||
           string_agg('🍼 *' || a.nome || '* — parto em ' ||
                      public.dias(r.data_prevista_parto - current_date), chr(10))
      from public.reproducao r
      join public.animais a on a.id = r.animal_id
     where r.haras_id = v_haras and r.excluido_em is null and r.cria_id is null
       and r.data_prevista_parto between current_date and current_date + 45), '');

  if btrim(bloco) <> '' then
    partes := partes || ('*Precisa de atenção:*' || chr(10) || btrim(bloco, chr(10)));
  end if;

  -- ---------------------------------------------------------------- caixa
  if v_fin then
    bloco := coalesce((
      select 'Entrou ' || public.reais(rc.t) ||
             ' · Saiu ' || public.reais(dp.t) ||
             ' · Saldo ' || public.reais(coalesce(rc.t, 0) - coalesce(dp.t, 0))
        from (select sum(valor) t from public.receitas
               where haras_id = v_haras and excluido_em is null
                 and data >= date_trunc('month', current_date)) rc,
             (select sum(valor) t from public.despesas
               where haras_id = v_haras and excluido_em is null
                 and data >= date_trunc('month', current_date)) dp), '');
    if btrim(bloco) <> '' then
      partes := partes || ('*Caixa do mês:*' || chr(10) || bloco);
    end if;
  end if;

  return array_to_string(partes, chr(10) || chr(10));
end $$;

revoke execute on function public.agente_resumo_geral(uuid) from public, anon, authenticated;
grant execute on function public.agente_resumo_geral(uuid) to service_role;

commit;
