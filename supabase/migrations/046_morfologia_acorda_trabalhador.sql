-- 046 — Quem acorda o trabalhador de vídeo.
--
-- O serviço no Railway dorme quando não tem trabalho: parado ele não consome
-- nada, e é assim que um módulo que roda meia dúzia de vezes por mês cabe no
-- plano barato. Alguém precisa bater na porta quando chega vídeo.
--
-- SÓ BATE SE HOUVER TRABALHO
--
-- A verificação da fila vem ANTES do `net.http_post`, de propósito. Chamar o
-- serviço de cinco em cinco minutos para ele responder "nada a fazer" o
-- manteria acordado o mês inteiro — exatamente o custo que dormir evita. Com a
-- conferência antes, o despertador de fila vazia não custa nem uma requisição.
--
-- O SEGREDO NÃO ESTÁ NESTE ARQUIVO
--
-- O repositório é público. O cabeçalho sai do Vault, como já fazem o resumo
-- matinal e o vigia. Quem coloca o valor lá é um script fora do repositório.

begin;

create or replace function public.morfologia_acordar_trabalhador()
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_pedido bigint;
  v_segredo text;
begin
  /* `tentativas < 3` repete o teto de `morfologia_tarefa_pegar`: sem isso, uma
     tarefa esgotada acordaria o serviço de cinco em cinco minutos para ele
     olhar a fila e não pegar nada. */
  if not exists (
    select 1 from public.morfologia_tarefas
     where tipo = 'PROCESSAR_MIDIA'
       and situacao = 'na_fila'
       and tentativas < 3
  ) then
    return null;
  end if;

  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'morfologia_worker_segredo';
  if v_segredo is null then
    raise exception 'Segredo morfologia_worker_segredo não está no Vault.';
  end if;

  /*
    Espera curta de propósito.

    O trabalhador só responde no fim de tudo, e três vídeos passam de um
    minuto. Quem chama aqui não precisa da resposta — precisa que o serviço
    acorde. O trabalho continua depois do fim da espera; o resultado aparece
    na tabela de quadros, não nesta chamada.
  */
  select net.http_post(
    url := 'https://morfologia-frames-production.up.railway.app/trabalhar',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_pedido;

  return v_pedido;
end $$;

revoke all on function public.morfologia_acordar_trabalhador() from public, anon, authenticated;
grant execute on function public.morfologia_acordar_trabalhador() to service_role;

commit;

-- --------------------------------------------------------------- agendador
--
-- Fora da transação: `cron.schedule` grava na própria tabela do agendador.
--
-- De cinco em cinco minutos, em minutos quebrados. O dono manda o vídeo e
-- espera o laudo; meia hora de espera para começar seria ruim. Cinco minutos
-- é o pior caso — quando a coleta terminar pelo WhatsApp, o próprio webhook
-- vai chamar `morfologia_acordar_trabalhador()` na hora, e este agendador
-- passa a ser só a rede de segurança para quando essa chamada falhar.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'morfologia-video') then
    perform cron.unschedule('morfologia-video');
  end if;
end $$;

select cron.schedule(
  'morfologia-video',
  '4,9,14,19,24,29,34,39,44,49,54,59 * * * *',
  $cron$ select public.morfologia_acordar_trabalhador(); $cron$
);
