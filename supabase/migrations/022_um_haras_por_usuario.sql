-- 022 — "Um haras por pessoa" deixa de ser combinado e vira regra do banco.
--
-- Toda política de RLS do sistema depende de `meu_haras_id()`, que era:
--
--   select haras_id from public.membros where user_id = auth.uid() limit 1
--
-- `limit 1` sem `order by` não escolhe: devolve a linha que o plano de
-- execução entregar primeiro, e isso pode MUDAR entre duas consultas na mesma
-- sessão. Com duas filiações, o mesmo usuário veria o haras A numa tela e o
-- haras B na seguinte — e escreveria em qualquer um dos dois.
--
-- `criar_haras` e `aceitar_convite` já barram a segunda filiação, cada uma com
-- seu `if exists`. Duas coisas continuavam abertas:
--
--   CORRIDA — duas chamadas simultâneas passam as duas pelo `if exists` e
--   inserem as duas. A checagem lê antes de gravar, sem trava.
--
--   O CAMINHO DE FORA — SQL manual de manutenção não passa por função
--   nenhuma. Foi assim que este projeto ganhou um haras órfão.
--
-- Uma restrição única resolve os dois: a garantia passa a ser do banco, não da
-- lembrança de quem escreve a próxima função.

begin;

-- Se já houvesse duplicata, o índice falharia aqui e a migração inteira
-- pararia — que é o comportamento certo. Melhor parar do que "consertar"
-- escolhendo por conta própria qual filiação da pessoa jogar fora.
create unique index if not exists membros_user_id_unico
  on public.membros (user_id);

comment on index public.membros_user_id_unico is
  'Uma pessoa pertence a um haras só. meu_haras_id() depende disso para ser deterministica.';

-- Determinismo mesmo assim.
--
-- Não é redundância inútil: se um dia a regra do produto mudar e o índice cair
-- para permitir várias filiações, esta função volta a ser ambígua em silêncio.
-- Com `order by`, o pior caso vira "sempre o haras mais antigo" — errado, mas
-- estável e perceptível, em vez de alternar entre telas.
create or replace function public.meu_haras_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select haras_id from public.membros
   where user_id = auth.uid()
   order by created_at, haras_id
   limit 1
$$;

/*
  `criar_haras` tratava QUALQUER unique_violation como slug repetido.

  Com o índice novo, bater na filiação duplicada passaria a responder "Este
  endereço já está em uso. Escolha outro." — e a pessoa ficaria trocando o
  nome do haras para sempre, sem nunca acertar, porque o problema era outro.
*/
create or replace function public.criar_haras(p_nome text, p_slug text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Este usuário já pertence a um haras.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do haras.';
  end if;

  insert into public.haras (nome, slug) values (trim(p_nome), p_slug)
  returning id into v_id;

  insert into public.membros (haras_id, user_id, papel)
  values (v_id, auth.uid(), 'dono');

  return v_id;
exception
  when unique_violation then
    -- Distingue as duas colisões possíveis pelo nome da restrição.
    if sqlerrm like '%membros_user_id_unico%' then
      raise exception 'Este usuário já pertence a um haras.';
    end if;
    raise exception 'Este endereço já está em uso. Escolha outro.';
end $$;

-- A 021 tirou o execute de PUBLIC; `create or replace` não devolve grant, mas
-- deixar explícito evita depender disso.
revoke execute on function public.criar_haras(text, text) from public, anon;
grant execute on function public.criar_haras(text, text) to authenticated;
revoke execute on function public.meu_haras_id() from public;
grant execute on function public.meu_haras_id() to anon, authenticated;

commit;
