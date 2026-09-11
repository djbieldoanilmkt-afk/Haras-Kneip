-- 036 — `criar_despesa` passa a aceitar o evento.
--
-- A 035 criou `despesas.evento_id`, mas a tela grava por `criar_despesa`, cuja
-- assinatura não tinha o campo. Sem isto o seletor de evento no formulário
-- seria decorativo: a pessoa escolheria "Copa de Março", salvaria, e a despesa
-- entraria solta — sem erro nenhum, que é o pior jeito de falhar.
--
-- Cópia fiel da função da 009, com um parâmetro a mais. Não reescrevi de
-- memória: ela carrega a checagem de que o rateio SOMA exatamente o valor da
-- nota, e essa regra é o que mantém o custo por animal batendo com o total.

begin;

create or replace function public.criar_despesa(
  p_data date,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_fornecedor text default null,
  p_observacoes text default null,
  p_rateios jsonb default '[]'::jsonb,
  p_evento uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_id uuid;
  v_soma numeric;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  if not public.haras_escreve(v_haras) then
    raise exception 'Conta sem permissão de escrita.';
  end if;
  if not public.ve_financeiro() then
    raise exception 'Seu perfil não tem acesso ao financeiro.';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero.';
  end if;

  -- Evento de outro haras não agrupa despesa nossa.
  if p_evento is not null and not exists (
    select 1 from public.eventos where id = p_evento and haras_id = v_haras
  ) then
    raise exception 'Evento não encontrado neste haras.';
  end if;

  if jsonb_array_length(p_rateios) > 0 then
    select sum((r ->> 'valor')::numeric) into v_soma
      from jsonb_array_elements(p_rateios) r;

    if v_soma <> p_valor then
      raise exception 'O rateio soma % e a despesa é de % — não fecha.', v_soma, p_valor;
    end if;
  end if;

  insert into public.despesas
    (haras_id, data, categoria, descricao, valor, fornecedor, observacoes, evento_id)
  values (v_haras, p_data, p_categoria, p_descricao, p_valor,
          nullif(trim(coalesce(p_fornecedor, '')), ''),
          nullif(trim(coalesce(p_observacoes, '')), ''),
          p_evento)
  returning id into v_id;

  if jsonb_array_length(p_rateios) > 0 then
    insert into public.despesa_rateios (despesa_id, animal_id, haras_id, valor)
    select v_id, (r ->> 'animal_id')::uuid, v_haras, (r ->> 'valor')::numeric
      from jsonb_array_elements(p_rateios) r;
  end if;

  return v_id;
end $$;

-- A versão de 7 parâmetros sai: mantida, o PostgREST teria duas candidatas
-- para a mesma chamada.
drop function if exists public.criar_despesa(date, text, text, numeric, text, text, jsonb);

revoke execute on function public.criar_despesa(date, text, text, numeric, text, text, jsonb, uuid)
  from public, anon;
grant execute on function public.criar_despesa(date, text, text, numeric, text, text, jsonb, uuid)
  to authenticated;

commit;
