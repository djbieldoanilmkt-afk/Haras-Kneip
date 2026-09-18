-- ============================================================================
-- VERIFICACAO DE TELEFONE POR PIN
-- Rode depois do 007_equipe.sql.
--
-- Fluxo: o dono cadastra o telefone do membro e gera um PIN. A pessoa manda
-- uma mensagem para o numero do assistente com esse PIN. O agente confere as
-- DUAS coisas — o numero de origem bate com o declarado E o PIN bate.
--
-- Exigir os dois e o que torna seguro o dono digitar o numero de outra pessoa:
-- digitar apenas REIVINDICA o numero; quem prova e o celular, mandando a
-- mensagem. E o PIN sozinho nao serve para nada, porque so vale se chegar do
-- numero declarado — o que torna forca bruta inutil para quem nao controla
-- aquele aparelho.
-- ============================================================================

begin;

alter table public.membros add column if not exists pin_verificacao text;
alter table public.membros add column if not exists pin_expira_em timestamptz;
alter table public.membros add column if not exists pin_tentativas int not null default 0;

-- --------------------------------------------------------- normalizacao

/*
  Espelha normalizarTelefone() em src/lib/telefone.ts.

  Existe nos dois lugares porque sao usos diferentes: o TypeScript valida o
  que a pessoa digita na tela, e este aqui casa o numero que chega do
  WhatsApp — que vem so com digitos, sem "+" e sem mascara. A versao SQL e
  deliberadamente permissiva: o trabalho dela e reconhecer, nao recusar.
*/
create or replace function public.normalizar_telefone(p_entrada text)
returns text
language plpgsql immutable
as $$
declare
  d text := regexp_replace(coalesce(p_entrada, ''), '\D', '', 'g');
  nacional text;
begin
  if d = '' then return null; end if;

  nacional := case
    when left(d, 2) = '55' and length(d) in (12, 13) then substr(d, 3)
    else d
  end;

  if length(nacional) not in (10, 11) then return null; end if;
  if substr(nacional, 1, 2)::int < 11 then return null; end if;

  return '+55' || nacional;
end $$;

-- --------------------------------------------------- reset da verificacao

/*
  Trocou o numero, perdeu a verificacao.

  Precisa ser gatilho e nao regra na funcao: o membro pode alterar o proprio
  telefone por UPDATE direto (grant por coluna, 006). Sem isto, quem estivesse
  verificado trocaria o numero e a marca de verificado passaria a valer para
  um numero que ninguem provou.
*/
create or replace function public.limpar_verificacao_telefone()
returns trigger
language plpgsql
as $$
begin
  if new.telefone is distinct from old.telefone then
    new.telefone_verificado_em := null;
    new.pin_verificacao := null;
    new.pin_expira_em := null;
    new.pin_tentativas := 0;
  end if;
  return new;
end $$;

drop trigger if exists membros_limpar_verificacao on public.membros;
create trigger membros_limpar_verificacao
  before update on public.membros
  for each row execute function public.limpar_verificacao_telefone();

-- ------------------------------------------------------------- funcoes

/** O dono cadastra o telefone de alguem da equipe. Apenas reivindica. */
create or replace function public.definir_telefone_membro(p_user uuid, p_telefone text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_numero text := public.normalizar_telefone(p_telefone);
begin
  if v_haras is null or not public.sou_dono() then
    raise exception 'Só o dono da conta pode alterar o telefone da equipe.';
  end if;
  if p_telefone is not null and trim(p_telefone) <> '' and v_numero is null then
    raise exception 'Telefone inválido.';
  end if;

  update public.membros
     set telefone = v_numero
   where haras_id = v_haras and user_id = p_user;

  if not found then
    raise exception 'Membro não encontrado nesta equipe.';
  end if;
exception
  when unique_violation then
    raise exception 'Este telefone já está cadastrado em outra conta.';
end $$;

/**
 * Gera o PIN. Devolve em texto porque o dono precisa ler para repassar — e
 * por isso ele fica curto e expira rapido, em vez de ser guardado com hash.
 */
create or replace function public.gerar_pin_telefone(p_user uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.meu_haras_id();
  v_tel text;
  v_pin text;
begin
  if v_haras is null then
    raise exception 'Sessão sem haras.';
  end if;
  -- O dono gera para qualquer um; qualquer membro gera para si mesmo.
  if not public.sou_dono() and p_user <> auth.uid() then
    raise exception 'Você só pode gerar o PIN do seu próprio número.';
  end if;

  select telefone into v_tel
    from public.membros where haras_id = v_haras and user_id = p_user;

  if v_tel is null then
    raise exception 'Cadastre o telefone antes de gerar o PIN.';
  end if;

  -- gen_random_bytes, e nao random(): PIN e credencial, ainda que de vida
  -- curta. A mascara zera o bit de sinal — o deslocamento aritmetico de
  -- bigint preserva o sinal e devolveria PIN negativo.
  v_pin := lpad(
    (((('x' || encode(extensions.gen_random_bytes(8), 'hex'))::bit(64))::bigint
      & 9223372036854775807) % 1000000)::text, 6, '0');

  update public.membros
     set pin_verificacao = v_pin,
         pin_expira_em = now() + interval '24 hours',
         pin_tentativas = 0
   where haras_id = v_haras and user_id = p_user;

  return v_pin;
end $$;

/**
 * Chamada pelo backend do agente quando chega uma mensagem.
 *
 * NAO e exposta a anon nem a authenticated de proposito: se qualquer pessoa
 * logada pudesse chamar, daria para varrer PINs pela API passando um numero
 * arbitrario. So o servico do agente executa.
 */
create or replace function public.verificar_telefone_por_pin(p_numero text, p_pin text)
returns table (user_id uuid, haras_id uuid)
language plpgsql security definer
set search_path = public
as $$
declare
  v_numero text := public.normalizar_telefone(p_numero);
  v_pin text := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  v_membro record;
begin
  if v_numero is null or v_pin = '' then
    return;
  end if;

  select m.user_id, m.haras_id, m.pin_verificacao, m.pin_expira_em, m.pin_tentativas
    into v_membro
    from public.membros m
   where m.telefone = v_numero;

  if not found or v_membro.pin_verificacao is null then
    return;
  end if;

  if v_membro.pin_expira_em < now() or v_membro.pin_tentativas >= 5 then
    return;
  end if;

  if v_membro.pin_verificacao <> v_pin then
    update public.membros set pin_tentativas = pin_tentativas + 1
     where membros.user_id = v_membro.user_id;
    return;
  end if;

  -- O gatilho de limpeza so dispara quando o telefone muda, entao marcar
  -- verificado aqui nao se auto-anula.
  update public.membros
     set telefone_verificado_em = now(),
         pin_verificacao = null,
         pin_expira_em = null,
         pin_tentativas = 0
   where membros.user_id = v_membro.user_id;

  return query select v_membro.user_id, v_membro.haras_id;
end $$;

/**
 * Quem esta falando, para o agente. So devolve numero JA verificado —
 * numero apenas reivindicado nao escreve nada.
 */
create or replace function public.membro_por_telefone(p_numero text)
returns table (user_id uuid, haras_id uuid, papel text)
language sql stable security definer
set search_path = public
as $$
  select m.user_id, m.haras_id, m.papel
  from public.membros m
  where m.telefone = public.normalizar_telefone(p_numero)
    and m.telefone_verificado_em is not null
$$;

/*
  Reescreve minha_equipe() de 007 para levar o estado da verificacao.

  `tem_pin` em vez do PIN: a lista da equipe e so um resumo, e devolver o
  codigo em toda carga da tela o espalharia por log e cache sem necessidade.
  Quem quer ver o PIN chama gerar_pin_telefone e recebe na hora.
*/
-- `create or replace` nao muda o tipo de retorno de uma funcao que devolve
-- table; a assinatura de 007 tinha menos colunas.
drop function if exists public.minha_equipe();

create function public.minha_equipe()
returns table (
  user_id uuid,
  email text,
  papel text,
  telefone text,
  verificado_em timestamptz,
  tem_pin boolean,
  desde timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    m.user_id,
    u.email::text,
    m.papel,
    m.telefone,
    m.telefone_verificado_em,
    (m.pin_verificacao is not null and m.pin_expira_em > now()),
    m.created_at
  from public.membros m
  join auth.users u on u.id = m.user_id
  where m.haras_id = public.meu_haras_id()
  order by (m.papel = 'dono') desc, u.email
$$;

revoke execute on function public.minha_equipe() from anon, public;
grant execute on function public.minha_equipe() to authenticated;

-- ------------------------------------------------------------- permissoes

revoke execute on function public.definir_telefone_membro(uuid, text) from anon, public;
revoke execute on function public.gerar_pin_telefone(uuid) from anon, public;
grant execute on function public.definir_telefone_membro(uuid, text) to authenticated;
grant execute on function public.gerar_pin_telefone(uuid) to authenticated;

-- Estas duas sao do servico do agente, nao do navegador.
revoke execute on function public.verificar_telefone_por_pin(text, text)
  from anon, authenticated, public;
revoke execute on function public.membro_por_telefone(text)
  from anon, authenticated, public;
grant execute on function public.verificar_telefone_por_pin(text, text) to service_role;
grant execute on function public.membro_por_telefone(text) to service_role;

commit;
