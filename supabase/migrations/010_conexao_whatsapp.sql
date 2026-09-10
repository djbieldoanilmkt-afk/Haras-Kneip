-- ============================================================================
-- CONEXAO DO WHATSAPP (EVOLUTION API)
-- Rode depois do 009_papeis_e_despesa_atomica.sql.
--
-- O nome da instancia na Evolution NAO fica guardado: e derivado do id do
-- haras, sempre igual, e derivar evita o estado divergir do que existe la.
-- O que se guarda e o que so o WhatsApp sabe — qual numero atendeu ao QR e
-- quando conectou.
-- ============================================================================

begin;

alter table public.haras add column if not exists whatsapp_numero text;
alter table public.haras add column if not exists whatsapp_conectado_em timestamptz;

/*
  Nome da instancia. Prefixo + id sem hifens.

  Derivado, e nao escolhido: se fosse um campo, dois haras poderiam apontar
  para a mesma instancia por engano e um leria as mensagens do outro.
*/
create or replace function public.instancia_whatsapp(p_haras uuid)
returns text
language sql immutable
as $$
  select 'haras_' || replace(p_haras::text, '-', '')
$$;

/*
  Caminho de volta: da instancia para o haras.

  O webhook recebe o nome da instancia e precisa saber de quem e. Desmontar o
  nome com regex no TypeScript funcionaria hoje e quebraria no dia que o
  formato mudasse — perguntar a quem monta mantem as duas pontas juntas.
*/
create or replace function public.haras_por_instancia(p_instancia text)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.haras where public.instancia_whatsapp(id) = p_instancia
$$;

revoke execute on function public.haras_por_instancia(text) from anon, authenticated, public;
grant execute on function public.haras_por_instancia(text) to service_role;

/*
  Registra a conexao. Chamada pela Edge Function com service_role depois que
  a Evolution confirma que a instancia abriu.

  Fica em funcao porque o dono NAO tem update nestas colunas: elas descrevem
  um fato observado no WhatsApp, nao uma preferencia. Deixar editavel na tela
  permitiria declarar um numero conectado que nunca conectou.
*/
create or replace function public.registrar_conexao_whatsapp(p_haras uuid, p_numero text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.haras
     set whatsapp_numero = public.normalizar_telefone(p_numero),
         whatsapp_conectado_em = case when p_numero is null then null else now() end
   where id = p_haras;
end $$;

revoke execute on function public.registrar_conexao_whatsapp(uuid, text)
  from anon, authenticated, public;
grant execute on function public.registrar_conexao_whatsapp(uuid, text) to service_role;

grant execute on function public.instancia_whatsapp(uuid) to authenticated, service_role;

commit;
