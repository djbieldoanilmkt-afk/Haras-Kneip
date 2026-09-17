-- 056 — Quem chama o laudo e a entrega.
--
-- Terceiro e último despertador do módulo, com o mesmo desenho dos outros:
-- confere a fila ANTES de bater na porta. Chamada à toa é invocação cobrada e
-- log a mais para atrapalhar quem for procurar um problema de verdade.
--
-- Com este, a avaliação anda inteira sozinha: mídia pronta chama a análise, a
-- análise chama a revisão, a revisão reconcilia e chama o laudo, o laudo chama
-- a entrega — e a entrega encerra.

begin;

create or replace function public.morfologia_acordar_laudo()
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_pedido bigint;
  v_segredo text;
begin
  if not exists (
    select 1 from public.morfologia_tarefas
     where tipo in ('GERAR_RELATORIO', 'ENVIAR_WHATSAPP')
       and situacao = 'na_fila'
       and tentativas < 3
  ) then
    return null;
  end if;

  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'resumo_segredo';
  if v_segredo is null then
    raise exception 'Segredo resumo_segredo não está no Vault.';
  end if;

  select net.http_post(
    url := 'https://nesnxcmdfksakgspvkcg.supabase.co/functions/v1/morfologia-laudo',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_pedido;

  return v_pedido;
end $$;

revoke all on function public.morfologia_acordar_laudo() from public, anon, authenticated;
grant execute on function public.morfologia_acordar_laudo() to service_role;

commit;

-- --------------------------------------------------------------- agendador
--
-- Deslocado dos outros dois: o do vídeo passa em 4,9,14…, o da análise em
-- 2,7,12…, o vigia aos 17. Três disparos no mesmo minuto competiriam pela
-- mesma janela de rede sem precisar.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'morfologia-laudo') then
    perform cron.unschedule('morfologia-laudo');
  end if;
end $$;

select cron.schedule(
  'morfologia-laudo',
  '6,11,16,21,26,31,36,41,46,51,56 * * * *',
  $cron$ select public.morfologia_acordar_laudo(); $cron$
);
