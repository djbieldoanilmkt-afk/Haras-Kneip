-- 052 — Quem chama a leitura das imagens.
--
-- Mesmo desenho do despertador do vídeo (046): confere a fila ANTES de bater na
-- porta. Aqui a economia é outra — Edge Function não fica acordada, mas cada
-- chamada à toa é uma invocação cobrada e um log a mais para atrapalhar quando
-- alguém for procurar um problema de verdade.
--
-- O segredo é o mesmo `resumo_segredo` do Vault, já usado pelo resumo matinal e
-- pelo vigia: é o segredo dos disparos internos por pg_cron, não o do webhook
-- da Evolution — aquele é de outra porta e continua separado.

begin;

/* A função de análise lê os grupos por RPC; sem isto ela não passa da primeira
   chamada. Função em `public` nasce fechada desde a 021. */
revoke all on function public.morfologia_grupos_de_analise() from public, anon, authenticated;
grant execute on function public.morfologia_grupos_de_analise() to service_role;

create or replace function public.morfologia_acordar_analise()
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
     where tipo in ('ANALISE_PRIMARIA', 'ANALISE_REVISAO')
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

  /*
    Espera curta: quem chama não precisa da resposta.

    Seis chamadas de visão passam de um minuto. A leitura acontece depois do
    fim desta espera; o resultado aparece nas notas, não aqui.
  */
  select net.http_post(
    url := 'https://nesnxcmdfksakgspvkcg.supabase.co/functions/v1/morfologia-analise',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_pedido;

  return v_pedido;
end $$;

revoke all on function public.morfologia_acordar_analise() from public, anon, authenticated;
grant execute on function public.morfologia_acordar_analise() to service_role;

commit;

-- --------------------------------------------------------------- agendador
--
-- Fora da transação: `cron.schedule` grava na tabela do agendador.
--
-- Em minutos deslocados dos outros dois trabalhos: o do vídeo passa em
-- 4,9,14…, o vigia aos 17. Três disparos no mesmo minuto competiriam pela
-- mesma janela de rede sem precisar.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'morfologia-analise') then
    perform cron.unschedule('morfologia-analise');
  end if;
end $$;

select cron.schedule(
  'morfologia-analise',
  '2,7,12,22,27,32,37,42,47,52,57 * * * *',
  $cron$ select public.morfologia_acordar_analise(); $cron$
);
