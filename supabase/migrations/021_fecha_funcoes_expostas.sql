-- 021 — Fecha as funções que estavam abertas a quem não fez login.
--
-- ORIGEM DO FURO
--
-- No PostgreSQL, função nasce executável por PUBLIC. Escrever
-- `grant execute ... to service_role` NÃO tira de ninguém — só acrescenta.
-- A 014 fez exatamente isso com `resolver_ancestral` e esqueceu o `revoke`.
--
-- Consequência medida, não suposta: com a chave anônima (que é pública, e está
-- no histórico de um repositório público), sem login, dava para chamar
--
--   resolver_ancestral(haras_id, 'nome', 'sexo', null)
--
-- contra QUALQUER haras cujo id se conheça — e o id do primeiro é
-- 00000000-0000-0000-0000-000000000001. A função é `security definer`, então
-- ignora o RLS, e recebe o haras por parâmetro sem conferir nada. Nome que já
-- existe devolvia o id do animal (vazamento entre inquilinos); nome novo
-- INSERIA linha em `animais` de um haras alheio.
--
-- O QUE FICA ABERTO, DE PROPÓSITO
--
-- `meu_haras_id` continua ao alcance do anônimo porque a política
-- `haras_vitrine` a chama, e essa política vale para {anon, authenticated}:
-- revogá-la derrubaria o link público do plantel. Para quem não fez login ela
-- devolve nulo.
--
-- `estatisticas_publicas` também fica: a landing mostra os números para
-- visitante deslogado.

begin;

-- 1) O furo -----------------------------------------------------------------
revoke execute on function public.resolver_ancestral(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.resolver_ancestral(uuid, text, text, uuid)
  to service_role;

-- 2) Funções de gatilho -----------------------------------------------------
--
-- Gatilho dispara com os privilégios do dono da função; ninguém precisa de
-- EXECUTE para que ele funcione. Estarem abertas não servia a nada.
revoke execute on function public.definir_autoria() from public, anon, authenticated;
revoke execute on function public.definir_haras_id() from public, anon, authenticated;
revoke execute on function public.genealogia_do_parto() from public, anon, authenticated;

-- 3) Auxiliares de RLS: fora do alcance de quem não fez login ---------------
--
-- São usadas dentro de políticas que valem para `authenticated`, então esse
-- papel precisa de EXECUTE. O anônimo não: `haras_escreve` respondia `true`
-- para ele, confirmando que aquele haras existe e está ativo.
revoke execute on function public.haras_escreve(uuid) from public, anon;
revoke execute on function public.meu_papel() from public, anon;
revoke execute on function public.ve_financeiro() from public, anon;
grant execute on function public.haras_escreve(uuid) to authenticated;
grant execute on function public.meu_papel() to authenticated;
grant execute on function public.ve_financeiro() to authenticated;

-- 4) Criar haras exige sessão ----------------------------------------------
-- Já recusava com "É preciso estar autenticado", mas recusar na porta é
-- melhor que recusar lá dentro.
revoke execute on function public.criar_haras(text, text) from public, anon;
grant execute on function public.criar_haras(text, text) to authenticated;

-- 5) A causa raiz, não só este caso ----------------------------------------
--
-- Daqui em diante função nova nasce SEM execute para PUBLIC. Quem precisar de
-- acesso pelo navegador terá de escrever o `grant` explícito. O modo de
-- falhar vira "permissão negada" no teste — barulhento — em vez de uma porta
-- aberta que ninguém vê.
alter default privileges in schema public revoke execute on functions from public;

commit;
