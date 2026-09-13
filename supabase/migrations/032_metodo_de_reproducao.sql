-- 032 — "Transferência de embrião" estava virando "Inseminação Artificial".
--
-- BUG EM PRODUÇÃO, encontrado testando a frase que Seu Hélio usaria.
--
-- `normalizar_metodo_reproducao` testava os ramos nesta ordem:
--
--   ... when p_metodo ilike '%insemin%' or p_metodo ilike '%ia%'  -> Inseminação
--       when p_metodo ilike '%embri%'   or p_metodo ilike '%te%'  -> Transferência
--
-- E "transferên**cia**" contém "ia". Então a frase inteira casava com o ramo
-- da inseminação ANTES de chegar ao de embrião. Medido:
--
--   'transferência de embrião'  -> Inseminação Artificial   (errado)
--   'transferencia de embriao'  -> Inseminação Artificial   (errado)
--   'TE'                        -> Transferência de Embrião (certo)
--   'embrião'                   -> Transferência de Embrião (certo)
--
-- Ou seja: funcionava só para quem abreviava. Quem falasse o nome completo —
-- o jeito natural — tinha o método trocado em silêncio, e o haras ficava com
-- o histórico reprodutivo errado.
--
-- DUAS CORREÇÕES
--
-- 1. Do mais específico para o mais genérico. "Transferência de embrião"
--    contém a palavra "embrião"; nada mais contém. Ela vai primeiro.
--
-- 2. Sigla é palavra inteira, não pedaço. '%ia%' e '%te%' casavam no meio de
--    qualquer palavra — era questão de tempo até "monta" ou "natural" ganharem
--    uma vizinha infeliz. Agora "IA" e "TE" só valem soltas.

begin;

create or replace function public.normalizar_metodo_reproducao(p_metodo text)
returns text
language sql immutable
as $$
  select case
    when p_metodo is null or trim(p_metodo) = '' then null
    -- Mais específico primeiro.
    when p_metodo ilike '%embri%' or p_metodo ilike '%transfer%'
      or p_metodo ~* '(^|[^a-zà-ú])te([^a-zà-ú]|$)' then 'Transferência de Embrião'
    when p_metodo ilike '%insemin%'
      or p_metodo ~* '(^|[^a-zà-ú])ia([^a-zà-ú]|$)' then 'Inseminação Artificial'
    when p_metodo ilike '%natural%' or p_metodo ilike '%monta%' then 'Monta Natural'
    else null
  end
$$;

/*
  O tipo também aceita o método.

  `tipo` é O QUE aconteceu (Cobertura, Parto...) e `metodo` é COMO. Quem fala
  não separa: diz "fiz transferência de embrião" e pronto. O normalizador já
  transformava 'inseminação' e 'monta' em 'Cobertura' e esquecia justamente o
  terceiro método — uma omissão, não uma regra.
*/
create or replace function public.normalizar_tipo_reproducao(p_tipo text)
returns text
language sql immutable
as $$
  select case
    when p_tipo ilike '%cobr%' or p_tipo ilike '%cobert%'
      or p_tipo ilike '%insemin%' or p_tipo ilike '%monta%'
      or p_tipo ilike '%embri%' or p_tipo ilike '%transfer%' then 'Cobertura'
    when p_tipo ilike '%diagn%' or p_tipo ilike '%dg%' or p_tipo ilike '%prenh%' then 'Diagnóstico de Gestação'
    when p_tipo ilike '%gesta%' then 'Gestação'
    when p_tipo ilike '%part%' or p_tipo ilike '%nasce%' then 'Parto'
    when p_tipo ilike '%desmam%' then 'Desmame'
    when p_tipo ilike '%cio%' then 'Cio'
    when p_tipo ilike '%abort%' or p_tipo ilike '%absor%' then 'Aborto'
    else null
  end
$$;

grant execute on function public.normalizar_tipo_reproducao(text) to authenticated, service_role;
grant execute on function public.normalizar_metodo_reproducao(text) to authenticated, service_role;

commit;
