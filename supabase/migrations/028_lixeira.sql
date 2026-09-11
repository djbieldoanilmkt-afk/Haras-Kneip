-- 028 — A lixeira que o agente prometia e não existia.
--
-- Ao apagar algo por WhatsApp, o agente responde "não sumiu de vez: dá para
-- restaurar no sistema, em Configurações". Essa tela nunca foi feita. O dado
-- realmente continua no banco — toda tabela reversível tem `excluido_em` —,
-- mas a única forma de trazer de volta era o "desfazer" do aviso na tela, que
-- some em segundos. Passou disso, a frase virava mentira.
--
-- Aproveito para tapar um buraco vizinho: `agente_ultimo_lancamento` foi
-- escrita na 015, antes de receitas existirem (023). "Apaga o último" não
-- alcançava uma receita — justamente o lançamento de maior valor do sistema.

begin;

/*
  O que está na lixeira deste haras.

  Financeiro entra só para quem pode vê-lo: a lixeira não pode virar a porta
  dos fundos para o peão ler quanto custou o garanhão.
*/
create or replace function public.lixeira()
returns table (
  tabela text,
  id uuid,
  descricao text,
  quando date,
  excluido_em timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select * from (
    select 'saude_registros'::text, s.id,
           (s.tipo || ' — ' || a.nome)::text, s.data_registro, s.excluido_em
      from public.saude_registros s join public.animais a on a.id = s.animal_id
     where s.haras_id = public.meu_haras_id() and s.excluido_em is not null
    union all
    select 'reproducao', r.id, (r.tipo || ' — ' || a.nome)::text, r.data_evento, r.excluido_em
      from public.reproducao r join public.animais a on a.id = r.animal_id
     where r.haras_id = public.meu_haras_id() and r.excluido_em is not null
    union all
    select 'pesagens', p.id, (p.peso || ' kg — ' || a.nome)::text, p.data_pesagem, p.excluido_em
      from public.pesagens p join public.animais a on a.id = p.animal_id
     where p.haras_id = public.meu_haras_id() and p.excluido_em is not null
    union all
    select 'anotacoes', n.id, (n.titulo || ' — ' || a.nome)::text, n.data_registro, n.excluido_em
      from public.anotacoes n join public.animais a on a.id = n.animal_id
     where n.haras_id = public.meu_haras_id() and n.excluido_em is not null
    union all
    select 'eventos', e.id, e.titulo::text, e.data_evento, e.excluido_em
      from public.eventos e
     where e.haras_id = public.meu_haras_id() and e.excluido_em is not null
    union all
    select 'despesas', d.id, (d.categoria || ' — ' || d.descricao)::text, d.data, d.excluido_em
      from public.despesas d
     where d.haras_id = public.meu_haras_id() and d.excluido_em is not null
       and public.ve_financeiro()
    union all
    select 'receitas', rc.id, (rc.categoria || ' — ' || rc.descricao)::text, rc.data, rc.excluido_em
      from public.receitas rc
     where rc.haras_id = public.meu_haras_id() and rc.excluido_em is not null
       and public.ve_financeiro()
  ) t(tabela, id, descricao, quando, excluido_em)
  order by t.excluido_em desc
$$;

/*
  "Apaga o último" passa a alcançar receita.

  A 015 listava cinco tabelas; receitas nasceu na 023. Sem isto, quem errasse
  o valor de uma venda por voz não teria como desfazer falando — e venda é o
  lançamento de maior valor que passa pelo agente.
*/
create or replace function public.agente_ultimo_lancamento(p_user uuid)
returns table (tabela text, id uuid, descricao text, quando timestamptz)
language sql stable security definer
set search_path = public
as $$
  select * from (
    select 'despesas'::text, d.id, (d.categoria || ' — ' || d.descricao)::text, d.created_at
      from public.despesas d where d.criado_por = p_user and d.excluido_em is null
    union all
    select 'receitas', rc.id, (rc.categoria || ' — ' || rc.descricao)::text, rc.created_at
      from public.receitas rc where rc.criado_por = p_user and rc.excluido_em is null
    union all
    select 'saude_registros', s.id, (s.tipo || ' — ' || a.nome)::text, s.created_at
      from public.saude_registros s join public.animais a on a.id = s.animal_id
     where s.criado_por = p_user and s.excluido_em is null
    union all
    select 'reproducao', r.id, (r.tipo || ' — ' || a.nome)::text, r.created_at
      from public.reproducao r join public.animais a on a.id = r.animal_id
     where r.criado_por = p_user and r.excluido_em is null
    union all
    select 'pesagens', p.id, (p.peso || ' kg — ' || a.nome)::text, p.created_at
      from public.pesagens p join public.animais a on a.id = p.animal_id
     where p.criado_por = p_user and p.excluido_em is null
    union all
    select 'anotacoes', n.id, ('Anotação — ' || a.nome)::text, n.created_at
      from public.anotacoes n join public.animais a on a.id = n.animal_id
     where n.criado_por = p_user and n.excluido_em is null
  ) t(tabela, id, descricao, quando) order by t.quando desc limit 1
$$;

revoke execute on function public.lixeira() from public, anon;
grant execute on function public.lixeira() to authenticated;

revoke execute on function public.agente_ultimo_lancamento(uuid)
  from public, anon, authenticated;
grant execute on function public.agente_ultimo_lancamento(uuid) to service_role;

commit;
