-- 055 — A entrega do laudo, e o fim da avaliação.
--
-- QUEM PEDIU PELA TELA NÃO RECEBE MENSAGEM
--
-- Uma avaliação aberta no app termina no app: quem pediu está olhando a tela.
-- Mandar o PDF no WhatsApp seria o sistema falando sem ter sido chamado — e o
-- dono do Kneip já recebe bastante mensagem do agente.
--
-- Avaliação aberta pelo WhatsApp termina no WhatsApp, que é onde a conversa
-- estava.
--
-- ENCERRAR FECHA A SESSÃO JUNTO
--
-- `morfologia_situacao` só enxerga avaliação aberta. Uma sessão apontando para
-- avaliação concluída deixaria o dono mandando foto e o agente respondendo que
-- não há avaliação nenhuma — sem explicar por quê.

begin;

/*
  Para quem mandar o laudo.

  Sai de quem ABRIU a avaliação, não da sessão: a sessão morre quando a coleta
  termina, e o laudo fica pronto minutos ou horas depois.
*/
create or replace function public.morfologia_destino_do_laudo(p_aval uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'telefone', m.telefone,
    'instancia', public.instancia_whatsapp(a.owner_haras_id),
    'nome', (select s.nome from public.morfologia_sujeitos s where s.avaliacao_id = a.id),
    'origem', a.origem)
    from public.morfologia_avaliacoes a
    left join public.membros m on m.user_id = a.criado_por
   where a.id = p_aval
$$;

/** Fecha a avaliação e a conversa que a acompanhava. */
create or replace function public.morfologia_encerrar(p_aval uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  update public.morfologia_avaliacoes
     set estado = 'CONCLUIDA',
         concluida_em = now(),
         atualizado_em = now()
   where id = p_aval;
  if not found then return false; end if;

  delete from public.morfologia_sessoes where avaliacao_id = p_aval;
  return true;
end $$;

/*
  Fecha a tarefa e chama a próxima, agora sabendo por onde a avaliação entrou.

  A sequência continua em `morfologia_proxima_etapa`. O que muda aqui é o
  último degrau: mandar no WhatsApp só faz sentido se foi de lá que veio o
  pedido.
*/
create or replace function public.morfologia_tarefa_concluir(
  p_id uuid, p_ok boolean, p_erro text default null
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_aval uuid;
  v_tipo text;
  v_proxima text;
  v_origem text;
begin
  update public.morfologia_tarefas
     set situacao = case when p_ok then 'concluida' else 'falhou' end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'erro sem descrição'), 2000) end,
         concluido_em = now()
   where id = p_id
  returning avaliacao_id, tipo into v_aval, v_tipo;

  if v_aval is null then return false; end if;
  if not p_ok then return true; end if;

  if v_tipo = 'ANALISE_REVISAO' then
    perform public.morfologia_reconciliar(v_aval);
  end if;

  if v_tipo = 'ENVIAR_WHATSAPP' then
    perform public.morfologia_encerrar(v_aval);
    return true;
  end if;

  v_proxima := public.morfologia_proxima_etapa(v_tipo);
  if v_proxima is null then return true; end if;

  select origem into v_origem from public.morfologia_avaliacoes where id = v_aval;

  if v_proxima = 'ENVIAR_WHATSAPP' and coalesce(v_origem, '') <> 'whatsapp' then
    perform public.morfologia_encerrar(v_aval);
    return true;
  end if;

  perform public.morfologia_enfileirar(v_aval, v_proxima);

  update public.morfologia_avaliacoes
     set estado = case v_proxima
           when 'ANALISE_PRIMARIA' then 'PROCESSANDO'
           when 'GERAR_RELATORIO'  then 'GERANDO_RELATORIO'
           else estado end,
         atualizado_em = now()
   where id = v_aval;

  return true;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_destino_do_laudo(uuid)',
    'public.morfologia_encerrar(uuid)',
    'public.morfologia_tarefa_concluir(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
