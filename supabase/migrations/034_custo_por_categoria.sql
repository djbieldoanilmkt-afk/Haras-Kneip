-- 034 — Custo por categoria de animal.
--
-- Seu Hélio, olhando o financeiro: "ele vai ter o valor total e dividir por
-- animal — custo médio animal, categoria, raça."
--
-- "Categoria" ali não é categoria de DESPESA (ração, ferrageamento), que já
-- existe. É a categoria do ANIMAL: quanto custa manter as éguas, os potros, os
-- garanhões. É o número que responde "o que eu seguro e o que eu vendo".
--
-- E é o que dá emprego a `categoria_do_animal()`, criada na 033 e até agora
-- sem nenhum uso — função sem chamador envelhece e diverge em silêncio.

begin;

/*
  Uma linha por categoria: quantos animais, quanto custaram, média por cabeça.

  O custo de um animal é a soma de duas fontes que nunca se encontram sozinhas:
  o que passou pelo veterinário (`saude_registros.custo`) e a parte dele nas
  despesas rateadas (`despesa_rateios`). Somar só uma das duas dá um número
  que parece certo e está pela metade.
*/
create or replace function public.custo_por_categoria(
  p_desde date default null,
  p_ate date default null
)
returns table (
  categoria text,
  animais bigint,
  custo_total numeric,
  custo_medio numeric
)
language sql stable security definer
set search_path = public
as $$
  with meu as (
    select a.id, a.nome,
           public.categoria_do_animal(a.sexo, a.status_reprodutivo, a.data_nascimento) as cat
    from public.animais a
    where a.haras_id = public.meu_haras_id()
      and a.ativo = true
      and a.externo = false
  ),
  sanidade as (
    select s.animal_id, sum(s.custo) as total
    from public.saude_registros s
    where s.haras_id = public.meu_haras_id() and s.excluido_em is null
      and s.custo is not null
      and (p_desde is null or s.data_registro >= p_desde)
      and (p_ate is null or s.data_registro <= p_ate)
    group by s.animal_id
  ),
  rateado as (
    select r.animal_id, sum(r.valor) as total
    from public.despesa_rateios r
    join public.despesas d on d.id = r.despesa_id
    where r.haras_id = public.meu_haras_id() and d.excluido_em is null
      and (p_desde is null or d.data >= p_desde)
      and (p_ate is null or d.data <= p_ate)
    group by r.animal_id
  )
  select
    m.cat,
    count(*)::bigint,
    round(sum(coalesce(s.total, 0) + coalesce(x.total, 0)), 2),
    -- `count(*)` nunca é zero dentro de um grupo, então a divisão é segura.
    round(sum(coalesce(s.total, 0) + coalesce(x.total, 0)) / count(*), 2)
  from meu m
  left join sanidade s on s.animal_id = m.id
  left join rateado x on x.animal_id = m.id
  -- Financeiro só para quem pode vê-lo.
  where public.ve_financeiro()
  group by m.cat
  order by 3 desc
$$;

revoke execute on function public.custo_por_categoria(date, date) from public, anon;
grant execute on function public.custo_por_categoria(date, date) to authenticated;

commit;
