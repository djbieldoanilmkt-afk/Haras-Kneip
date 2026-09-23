-- 016 — O agente falando primeiro, uma vez por dia.
--
-- Duas peças: a trava contra mensagem repetida e o agendador.

begin;

-- 1) Trava contra repetição -------------------------------------------------
--
-- O cron pode disparar duas vezes (retry do pg_net, replay manual, deploy no
-- meio da janela). Mandar o resumo duas vezes para o celular do dono não é um
-- erro invisível: parece sistema quebrado. Guardamos o dia do último envio.

alter table public.membros
  add column if not exists resumo_enviado_em date;

comment on column public.membros.resumo_enviado_em is
  'Dia do último resumo matinal entregue. Impede envio repetido no mesmo dia.';

-- 2) resumo_diario passa a respeitar a trava --------------------------------

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
                         case when p.proxima_data < current_date then ' (atrasado)'
                              when p.proxima_data = current_date then ' (hoje)'
                              else ' em ' || (p.proxima_data - current_date) || ' dias' end,
                         chr(10))
         from pendencias p where p.haras_id = h.id),
      (select string_agg('🍼 *' || t.nome || '* — parto ' ||
                         case when t.data_prevista_parto < current_date
                              then 'previsto há ' || (current_date - t.data_prevista_parto) || ' dias'
                              else 'em ' || (t.data_prevista_parto - current_date) || ' dias' end,
                         chr(10))
         from partos t where t.haras_id = h.id),
      case when m.papel in ('dono', 'gerente') then
        (select '💰 Gasto do mês: R$ ' || to_char(g.total, 'FM999G999D00')
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
    -- Só manda se houver algo além do cabeçalho.
    and (exists (select 1 from pendencias p where p.haras_id = h.id)
         or exists (select 1 from partos t where t.haras_id = h.id));
end $$;

-- 3) Marcação, chamada pela função de borda depois da entrega ---------------
--
-- Marcamos DEPOIS de a Evolution aceitar, não antes. Se o WhatsApp estiver
-- fora do ar, ninguém recebe e ninguém fica marcado — a próxima passada
-- tenta de novo. O risco invertido (marcar antes) seria perder o dia inteiro.

create or replace function public.marcar_resumo_enviado(p_telefones text[])
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  update public.membros
     set resumo_enviado_em = current_date
   where telefone = any (p_telefones);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.marcar_resumo_enviado(text[]) from anon, authenticated, public;
grant execute on function public.marcar_resumo_enviado(text[]) to service_role;

commit;
