-- 026 — Índices que faltavam e duas correções de higiene.
--
-- Nada aqui muda comportamento visível hoje, com 9 animais. Tudo aqui começa a
-- doer quando forem 10 haras com milhares de lançamentos — e aí é migração de
-- tabela grande, com a tela lenta enquanto roda.

begin;

-- ------------------------------------------------------- chaves sem índice
--
-- Toda chave estrangeira sem índice vira varredura de tabela inteira: no
-- `delete` do lado pai (o PostgreSQL precisa conferir os filhos) e em qualquer
-- consulta que filtre por ela. `criado_por` aparece em todas porque é o filtro
-- de "o último lançamento desta pessoa", que o desfazer usa.

create index if not exists animais_criado_por_idx on public.animais (criado_por);
create index if not exists anotacoes_criado_por_idx on public.anotacoes (criado_por);
create index if not exists configuracoes_criado_por_idx on public.configuracoes (criado_por);
create index if not exists convites_criado_por_idx on public.convites (criado_por);
create index if not exists despesas_criado_por_idx on public.despesas (criado_por);
create index if not exists eventos_criado_por_idx on public.eventos (criado_por);
create index if not exists genealogia_criado_por_idx on public.genealogia (criado_por);
create index if not exists pesagens_criado_por_idx on public.pesagens (criado_por);
create index if not exists reproducao_criado_por_idx on public.reproducao (criado_por);
create index if not exists saude_registros_criado_por_idx on public.saude_registros (criado_por);

-- A árvore genealógica sobe por avô/avó; sem índice, montar o pedigree de um
-- animal varre a tabela quatro vezes.
create index if not exists genealogia_avo_paterno_idx on public.genealogia (avo_paterno_id);
create index if not exists genealogia_avo_paterna_idx on public.genealogia (avo_paterna_id);
create index if not exists genealogia_avo_materno_idx on public.genealogia (avo_materno_id);
create index if not exists genealogia_avo_materna_idx on public.genealogia (avo_materna_id);

create index if not exists reproducao_cria_idx on public.reproducao (cria_id);
create index if not exists intencoes_haras_idx on public.intencoes (haras_id);
create index if not exists intencoes_user_idx on public.intencoes (user_id);

-- ---------------------------------------------------------------- higiene

/*
  Foto vazia é foto ausente.

  Havia uma linha com `foto_url = ''`. O código já trata string vazia como
  "sem foto" (o agente respondeu certo: "ainda não tem foto"), mas a diferença
  entre '' e nulo faz `foto_url is not null` mentir — foi o que me levou a
  diagnosticar um defeito que não existia.
*/
update public.animais set foto_url = null where foto_url = '';

/*
  O modelo não recebe mais "status reprodutivo" de macho.

  Todos os machos estão como 'Vazia', que quer dizer "não está prenha" — não
  existe para macho. Ia no prompt como "Diamante Negro · Macho · Vazia", e
  bastava o modelo levar a sério para responder besteira sobre reprodução.

  Corrijo aqui o que é meu: a relação que eu monto para o modelo. Os registros
  do haras ficam como estão — mudar o cadastro de quatro animais é decisão do
  dono, não minha.
*/
drop function if exists public.agente_plantel(uuid);

create function public.agente_plantel(p_user uuid)
returns table (id uuid, nome text, sexo text, status text)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.nome, a.sexo,
         case when a.sexo = 'Fêmea' then a.status_reprodutivo end
  from public.animais a
  join public.membros m on m.haras_id = a.haras_id
  where m.user_id = p_user
    and a.ativo = true
    and a.externo = false
  order by a.nome
$$;

revoke execute on function public.agente_plantel(uuid) from public, anon, authenticated;
grant execute on function public.agente_plantel(uuid) to service_role;

commit;
