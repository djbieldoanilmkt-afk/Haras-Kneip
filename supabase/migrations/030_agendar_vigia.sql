-- 030 — O vigia passa de hora em hora.
--
-- Hora em hora, e não a cada cinco minutos: as falhas que ele procura são
-- lentas (crédito acabando, sessão do WhatsApp caída). Consultar a Evolution e
-- a OpenRouter 288 vezes por dia para descobrir a mesma coisa seria barulho —
-- e a OpenRouter tem limite de requisições.
--
-- O segredo é o mesmo `resumo_segredo` do Vault, já usado pelo resumo matinal.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vigia-do-agente') then
    perform cron.unschedule('vigia-do-agente');
  end if;
end $$;

-- Aos 17 minutos, e não em ponto: no minuto zero todo agendador do mundo
-- dispara junto, e a Evolution já é compartilhada com outro sistema.
select cron.schedule(
  'vigia-do-agente',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := 'https://nesnxcmdfksakgspvkcg.supabase.co/functions/v1/agente-vigia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-segredo', (select decrypted_secret
                      from vault.decrypted_secrets
                     where name = 'resumo_segredo')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
