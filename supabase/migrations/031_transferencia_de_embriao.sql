-- 031 — Doadora, matriz e receptora.
--
-- Seu Hélio, dono do haras, foi direto ao ponto olhando o menu de reprodução:
-- "vai ter 1) doadora, 2) matriz, 3) receptora. A doadora ela põe na
-- receptora, matriz ela cria sozinha."
--
-- O PROBLEMA QUE ISSO REVELA
--
-- Na transferência de embrião a égua que PARE não é a mãe genética. A doadora
-- dá o embrião; a receptora gesta e pare. Hoje `reproducao` tem uma égua só, e
-- o gatilho `genealogia_do_parto` grava `mae_id = new.animal_id`.
--
-- Então quem lançar a gestação na receptora — que é o reflexo natural, porque
-- é ela que está prenha — faz o potro nascer com a MÃE ERRADA na árvore. Para
-- quem registra na ABCCMM, filiação errada é o erro mais caro que existe.
--
-- E o sistema hoje nem consegue guardar o dado certo: aceita o método
-- "Transferência de Embrião", mas não tem onde dizer quem carregou.
--
-- A DECISÃO
--
--   animal_id    = a MÃE GENÉTICA (doadora na TE, matriz na monta natural).
--                  É o que a genealogia usa, e continua usando.
--   receptora_id = quem gesta e pare, quando houve transferência.
--
-- Assim o gatilho continua certo sem mudar uma linha, e o dado que faltava
-- passa a caber. A tela e o agente é que precisam deixar claro qual é qual —
-- sem isso, a pessoa continua pondo a receptora no lugar da mãe.

begin;

alter table public.reproducao
  add column if not exists receptora_id uuid references public.animais(id) on delete set null;

comment on column public.reproducao.animal_id is
  'A mae GENETICA: doadora na transferencia de embriao, matriz na monta natural. E esta que vai para a arvore genealogica.';
comment on column public.reproducao.receptora_id is
  'A egua que gesta e pare, quando houve transferencia de embriao. Nao entra na genealogia.';

-- Uma égua não é receptora dela mesma. Se for a mesma, não houve
-- transferência — e deixar passar esconderia um erro de digitação que depois
-- vira dúvida sobre a filiação.
alter table public.reproducao drop constraint if exists reproducao_receptora_diferente;
alter table public.reproducao add constraint reproducao_receptora_diferente
  check (receptora_id is null or receptora_id <> animal_id);

create index if not exists reproducao_receptora_idx on public.reproducao (receptora_id);

/*
  A função da égua no haras, como Seu Hélio classificou.

  Fica no animal, e não só no evento, porque o haras pensa assim: "quais são
  minhas receptoras?" é pergunta de manejo, não de um parto específico.
  Nulo é válido — potra nova ainda não tem função definida.
*/
alter table public.animais
  add column if not exists funcao_reprodutiva text;

alter table public.animais drop constraint if exists animais_funcao_reprodutiva_check;
alter table public.animais add constraint animais_funcao_reprodutiva_check
  check (funcao_reprodutiva is null or funcao_reprodutiva in ('Matriz', 'Doadora', 'Receptora'));

comment on column public.animais.funcao_reprodutiva is
  'Matriz (cria o proprio), Doadora (da o embriao), Receptora (gesta o embriao de outra). So faz sentido para femea.';

/*
  Lançar reprodução com receptora.

  `p_receptora` é o NOME, não o id: quem fala no WhatsApp diz "receptora
  Fumaça", e a receptora muitas vezes é alugada de outro haras — então pode
  nem estar no plantel. `resolver_ancestral` já resolve os dois casos: acha a
  do plantel, ou cria o registro externo.
*/
create or replace function public.agente_lancar_reproducao(
  p_user uuid,
  p_animal uuid,
  p_tipo text,
  p_data date default null,
  p_garanhao text default null,
  p_metodo text default null,
  p_data_prevista_parto date default null,
  p_resultado text default null,
  p_receptora text default null
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
  v_receptora uuid;
begin
  if not exists (select 1 from public.animais where id = p_animal and haras_id = v_haras) then
    raise exception 'Animal não encontrado neste haras.';
  end if;
  if v_tipo is null then
    raise exception 'Não entendi o tipo do evento (recebi "%"). Foi cobertura, diagnóstico, parto, desmame, cio ou aborto?', p_tipo;
  end if;

  v_receptora := public.resolver_ancestral(v_haras, p_receptora, 'Fêmea', p_user);
  if v_receptora = p_animal then
    raise exception 'A receptora não pode ser a própria doadora.';
  end if;

  -- Gestação de equino: ~340 dias. Sem esta conta o parto não entra no painel.
  if v_parto is null and v_tipo = 'Cobertura' then
    v_parto := v_data + 340;
  end if;

  insert into public.reproducao
    (haras_id, animal_id, tipo, data_evento, garanhao, metodo,
     data_prevista_parto, resultado, receptora_id, criado_por, origem)
  values
    (v_haras, p_animal, v_tipo, v_data,
     nullif(trim(coalesce(p_garanhao, '')), ''),
     public.normalizar_metodo_reproducao(p_metodo),
     v_parto,
     nullif(trim(coalesce(p_resultado, '')), ''),
     v_receptora,
     p_user, 'whatsapp')
  returning id into v_id;

  return v_id;
end $$;

drop function if exists public.agente_lancar_reproducao(uuid, uuid, text, date, text, text, date, text);

revoke execute on function public.agente_lancar_reproducao(uuid, uuid, text, date, text, text, date, text, text)
  from public, anon, authenticated;
grant execute on function public.agente_lancar_reproducao(uuid, uuid, text, date, text, text, date, text, text)
  to service_role;

commit;
