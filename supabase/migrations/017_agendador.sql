-- 017 — Agendador do resumo matinal.
--
-- pg_cron acorda o banco; pg_net faz a chamada HTTP para a função de borda
-- `whatsapp-resumo`, que lê `resumo_diario()` e entrega pelo WhatsApp.
--
-- SEGREDO: este arquivo é público. O valor de `resumo_segredo` NÃO mora aqui.
-- Ele é criado fora do repositório com:
--
--   select vault.create_secret('<valor>', 'resumo_segredo',
--                              'Cabecalho x-segredo da funcao whatsapp-resumo');
--
-- O mesmo valor está registrado como a variável de ambiente RESUMO_SEGREDO da
-- função de borda. Se um dia divergirem, o cron passa a tomar 401 em silêncio
-- — por isso a verificação no fim deste arquivo.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

commit;

-- Fora da transação: cron.schedule grava na própria tabela de jobs.

-- Reagendar sem duplicar. `cron.unschedule` estoura se o job não existe, então
-- só chamamos quando ele existe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'resumo-matinal') then
    perform cron.unschedule('resumo-matinal');
  end if;
end $$;

-- 09:30 UTC = 06:30 no horário de Brasília. O banco roda em UTC; escrever
-- '6 30' aqui mandaria o "bom dia" às 3h30 da manhã.
select cron.schedule(
  'resumo-matinal',
  '30 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://nesnxcmdfksakgspvkcg.supabase.co/functions/v1/whatsapp-resumo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-segredo', (select decrypted_secret
                      from vault.decrypted_secrets
                     where name = 'resumo_segredo')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
