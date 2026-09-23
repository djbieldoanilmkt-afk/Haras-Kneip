-- 029 — Alguém vigiando o agente.
--
-- O agente é a parte do sistema que mais promete e a que mais tem como
-- quebrar em silêncio: crédito da OpenRouter acaba, o WhatsApp desconecta, o
-- servidor da Evolution cai. Em todos os casos ele simplesmente para de
-- responder — e quem descobre é o cliente, reclamando.
--
-- O AVISO PRECISA DE DOIS CAMINHOS
--
-- Se o WhatsApp caiu, avisar por WhatsApp não funciona. Então:
--
--   pelo APP    — vale para qualquer falha, mas depende de a pessoa abrir o
--                 sistema. É o caminho que nunca falha junto com o problema.
--   pelo WHATS  — chega na hora, e serve para o que NÃO derruba o WhatsApp:
--                 crédito acabando, erro do modelo.
--
-- Os dois juntos cobrem; nenhum dos dois sozinho cobre.

begin;

create table if not exists public.agente_saude (
  haras_id uuid primary key references public.haras(id) on delete cascade,

  /** 'open' | 'close' | 'connecting' | 'erro' — como a Evolution respondeu. */
  whatsapp_estado text,
  /** Última mensagem que o agente conseguiu processar de ponta a ponta. */
  ultima_mensagem_em timestamptz,
  /** Falha mais recente, em texto curto, para aparecer na tela. */
  ultimo_erro text,
  ultimo_erro_em timestamptz,
  /** Dólares restantes na OpenRouter. Nulo = não foi possível consultar. */
  credito_usd numeric(10, 4),
  /** Quando o vigia passou por aqui pela última vez. */
  verificado_em timestamptz,

  updated_at timestamptz not null default now()
);

alter table public.agente_saude enable row level security;

-- Só leitura, e só do próprio haras. Quem escreve é o vigia, sob service_role.
drop policy if exists agente_saude_sel on public.agente_saude;
create policy agente_saude_sel on public.agente_saude for select to authenticated
  using (haras_id = public.meu_haras_id());

revoke insert, update, delete on public.agente_saude from anon, authenticated;

/*
  O vigia grava aqui.

  `coalesce` em cada campo para uma checagem parcial não apagar o que a outra
  descobriu: quem consulta só o crédito não pode zerar o estado do WhatsApp.
*/
create or replace function public.registrar_saude_agente(
  p_haras uuid,
  p_whatsapp_estado text default null,
  p_credito numeric default null,
  p_erro text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.agente_saude
    (haras_id, whatsapp_estado, credito_usd, ultimo_erro, ultimo_erro_em, verificado_em)
  values
    (p_haras, p_whatsapp_estado, p_credito, p_erro,
     case when p_erro is not null then now() end, now())
  on conflict (haras_id) do update set
    whatsapp_estado = coalesce(excluded.whatsapp_estado, public.agente_saude.whatsapp_estado),
    credito_usd     = coalesce(excluded.credito_usd, public.agente_saude.credito_usd),
    ultimo_erro     = coalesce(excluded.ultimo_erro, public.agente_saude.ultimo_erro),
    ultimo_erro_em  = coalesce(excluded.ultimo_erro_em, public.agente_saude.ultimo_erro_em),
    verificado_em   = now(),
    updated_at      = now();
end $$;

/** Marca que o agente processou uma mensagem inteira, sem erro. */
create or replace function public.marcar_agente_vivo(p_haras uuid)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.agente_saude (haras_id, ultima_mensagem_em, verificado_em)
  values (p_haras, now(), now())
  on conflict (haras_id) do update set
    ultima_mensagem_em = now(),
    -- Uma mensagem inteira bem processada desmente o erro anterior.
    ultimo_erro = null,
    updated_at = now();
$$;

/*
  O diagnóstico que a tela mostra.

  Devolve o PORQUÊ, não só "ok/quebrado": "o assistente está fora do ar" sem
  motivo deixa a pessoa sem ação. Com o motivo ela sabe se reconecta o QR ou
  se põe crédito.
*/
create or replace function public.saude_do_agente()
returns table (
  saudavel boolean,
  motivo text,
  detalhe text,
  whatsapp_estado text,
  credito_usd numeric,
  ultima_mensagem_em timestamptz,
  verificado_em timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    coalesce(s.whatsapp_estado, 'desconhecido') = 'open'
      and coalesce(s.credito_usd, 1) > 0.5
      and s.ultimo_erro is null                       as saudavel,
    case
      when h.whatsapp_conectado_em is null then 'nunca_conectado'
      when coalesce(s.whatsapp_estado, 'open') <> 'open' then 'whatsapp_desconectado'
      when coalesce(s.credito_usd, 1) <= 0.5 then 'sem_credito'
      when s.ultimo_erro is not null then 'erro'
      else 'ok'
    end                                               as motivo,
    case
      when h.whatsapp_conectado_em is null
        then 'O assistente ainda não foi conectado. Leia o QR code aqui em Configurações.'
      when coalesce(s.whatsapp_estado, 'open') <> 'open'
        then 'O WhatsApp do assistente desconectou. Leia o QR code de novo para religar.'
      when coalesce(s.credito_usd, 1) <= 0.5
        then 'O crédito da inteligência artificial está acabando. Sem ele o assistente para de entender mensagens.'
      when s.ultimo_erro is not null then s.ultimo_erro
      else 'Tudo funcionando.'
    end                                               as detalhe,
    s.whatsapp_estado, s.credito_usd, s.ultima_mensagem_em, s.verificado_em
  from public.haras h
  left join public.agente_saude s on s.haras_id = h.id
  where h.id = public.meu_haras_id()
$$;

/** Quem o vigia precisa checar: haras com conta viva e WhatsApp já conectado. */
create or replace function public.haras_para_vigiar()
returns table (haras_id uuid, instancia text, telefone_dono text)
language sql stable security definer
set search_path = public
as $$
  select h.id, public.instancia_whatsapp(h.id),
         (select m.telefone from public.membros m
           where m.haras_id = h.id and m.papel = 'dono'
             and m.telefone_verificado_em is not null limit 1)
  from public.haras h
  where h.status_conta in ('trial', 'ativa')
    and h.whatsapp_conectado_em is not null
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'registrar_saude_agente(uuid, text, numeric, text)',
    'marcar_agente_vivo(uuid)',
    'haras_para_vigiar()',
    'saude_do_agente()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Esta a tela chama, como a pessoa logada.
grant execute on function public.saude_do_agente() to authenticated;

commit;
