-- 025 — Categoria de despesa vira lista fechada, como a de receita já é.
--
-- ENCONTRADO TESTANDO RECEITAS
--
-- `despesas.categoria` era texto livre. O agente escrevia o que o modelo
-- achasse: pedindo a categoria de uma compra de ração, ele sugeria
-- "Alimentação" e "Material de Limpeza" — rótulos que não existem em
-- src/lib/categorias.ts. E o banco já tinha uma despesa gravada como "ração",
-- minúscula, que nunca somaria com "Ração e suplemento" na tela "Por
-- categoria": duas linhas para o mesmo gasto, e nenhuma com o total certo.
--
-- É exatamente o que o comentário de categorias.ts previa. Faltava a metade
-- do banco.

begin;

/** Fala vira categoria da lista fechada. Nunca falha: sobra 'Outros'. */
create or replace function public.normalizar_categoria_despesa(p_texto text)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_texto is null then 'Outros'
    when p_texto ilike '%raç%' or p_texto ilike '%rac%' or p_texto ilike '%feno%'
      or p_texto ilike '%suplement%' or p_texto ilike '%aliment%' or p_texto ilike '%sal miner%'
      then 'Ração e suplemento'
    when p_texto ilike '%ferra%' or p_texto ilike '%casco%' or p_texto ilike '%cascate%'
      then 'Ferrageamento'
    when p_texto ilike '%veterin%' or p_texto ilike '%vet%' then 'Veterinário'
    when p_texto ilike '%medic%' or p_texto ilike '%remedi%' or p_texto ilike '%remédi%'
      or p_texto ilike '%vacin%' or p_texto ilike '%vermifug%'
      then 'Medicamento'
    when p_texto ilike '%mão de obra%' or p_texto ilike '%mao de obra%'
      or p_texto ilike '%salári%' or p_texto ilike '%salari%' or p_texto ilike '%funcion%'
      or p_texto ilike '%peão%' or p_texto ilike '%peao%' or p_texto ilike '%trato%'
      then 'Mão de obra'
    when p_texto ilike '%transport%' or p_texto ilike '%frete%' or p_texto ilike '%combust%'
      or p_texto ilike '%caminh%'
      then 'Transporte'
    when p_texto ilike '%manuten%' or p_texto ilike '%reparo%' or p_texto ilike '%cerca%'
      or p_texto ilike '%obra%'
      then 'Manutenção'
    when p_texto ilike '%taxa%' or p_texto ilike '%registro%' or p_texto ilike '%abccmm%'
      or p_texto ilike '%imposto%' or p_texto ilike '%anuidade%'
      then 'Taxas e registro'
    else 'Outros'
  end
$$;

-- Arruma o que já está gravado ANTES de exigir a restrição; senão a migração
-- para no meio e o banco fica sem a trava.
update public.despesas
   set categoria = public.normalizar_categoria_despesa(categoria)
 where categoria is null
    or categoria not in (
      'Ração e suplemento', 'Ferrageamento', 'Veterinário', 'Medicamento',
      'Mão de obra', 'Transporte', 'Manutenção', 'Taxas e registro', 'Outros'
    );

/*
  Lista fechada, alinhada letra a letra com CATEGORIAS_DESPESA em
  src/lib/categorias.ts. Mexeu numa, mexa na outra.
*/
alter table public.despesas drop constraint if exists despesas_categoria_check;
alter table public.despesas add constraint despesas_categoria_check
  check (categoria in (
    'Ração e suplemento',
    'Ferrageamento',
    'Veterinário',
    'Medicamento',
    'Mão de obra',
    'Transporte',
    'Manutenção',
    'Taxas e registro',
    'Outros'
  ));

/*
  A normalização vira gatilho, e não uma linha dentro de agente_lancar_despesa.

  Tentei o contrário primeiro e quase troquei um defeito por outro pior: a
  função tem rateio em centavos inteiros com o resto distribuído um a um, para
  a soma das partes bater com o valor da nota. Reescrevê-la só para trocar a
  categoria teria arrastado essa regra junto — e um `round(valor / n, 2)`
  ingênuo perde centavos em toda despesa rateada.

  O gatilho cobre TODOS os caminhos de escrita: a tela, o agente e o SQL de
  manutenção. E é idempotente — 'Ração e suplemento' passa pela regra e volta
  nela mesma —, então rodar na escrita da tela não estraga nada.
*/
create or replace function public.normalizar_despesa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.categoria := public.normalizar_categoria_despesa(new.categoria);
  return new;
end $$;

drop trigger if exists despesas_normalizar_categoria on public.despesas;
create trigger despesas_normalizar_categoria
  before insert or update of categoria on public.despesas
  for each row execute function public.normalizar_despesa();

revoke execute on function public.normalizar_despesa() from public, anon, authenticated;
revoke execute on function public.normalizar_categoria_despesa(text) from public, anon;
grant execute on function public.normalizar_categoria_despesa(text) to authenticated;

commit;
