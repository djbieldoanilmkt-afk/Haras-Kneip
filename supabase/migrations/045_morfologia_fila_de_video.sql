-- 045 — A fila que o trabalhador de vídeo consome.
--
-- POR QUE UM TRABALHADOR FORA DO SUPABASE
--
-- Edge Function é Deno puro: não tem FFmpeg e não tem como instalar. Extrair
-- quadro de vídeo é a única coisa do módulo que o Supabase não faz — então é
-- a única coisa que sai dele. O resto (IA, laudo, WhatsApp) continua aqui.
--
-- O trabalhador roda no Railway, com FFmpeg na imagem, e só conversa com o
-- banco por estas funções. Ele não monta SQL: pede tarefa, grava quadro,
-- fecha tarefa. Se amanhã ele for trocado por outro serviço, o contrato é
-- este arquivo.
--
-- PEGAR TAREFA É ATÔMICO
--
-- `for update skip locked` — dois trabalhadores simultâneos pegam tarefas
-- diferentes, nunca a mesma. Sem isso, o mesmo vídeo seria processado duas
-- vezes e os quadros sairiam duplicados.

begin;

-- ====================================================== caminho dos arquivos

/*
  Um lugar só decide onde o arquivo mora.

  O trabalhador precisa gravar quadro no mesmo balde onde o vídeo está, e a
  tela precisa achar. Convenção espalhada em três linguagens vira divergência
  na primeira pressa; aqui ela é função.
*/
create or replace function public.morfologia_caminho(
  p_haras uuid, p_avaliacao uuid, p_nome text
)
returns text
language sql immutable
as $$
  select p_haras::text || '/' || p_avaliacao::text || '/' || p_nome
$$;

-- ====================================================== enfileirar

/*
  Enfileira, e é seguro chamar de novo.

  A Evolution reenvia evento quando a resposta demora. Sem a chave única de
  (avaliação, tipo), o mesmo vídeo entraria na fila duas vezes. Com ela,
  chamar de novo é inócuo enquanto a tarefa está em andamento.

  Já tarefa FALHADA ou CONCLUÍDA volta para a fila. Falhada é óbvio. Concluída
  também precisa voltar: o dono manda um vídeo tremido, recebe o aviso, manda
  outro — e sem isto o segundo vídeo nunca seria processado, porque a tarefa
  daquela avaliação já existia. Reprocessar é seguro: o trabalhador apaga os
  quadros da mídia antes de gravar os novos, e o caminho no balde é o mesmo.

  'processando' fica de fora de propósito — reenfileirar o que está em curso é
  que duplicaria trabalho.
*/
create or replace function public.morfologia_enfileirar(
  p_avaliacao uuid, p_tipo text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_id uuid;
begin
  select owner_haras_id into v_haras
    from public.morfologia_avaliacoes where id = p_avaliacao;
  if v_haras is null then
    raise exception 'Avaliação % não existe.', p_avaliacao;
  end if;

  insert into public.morfologia_tarefas (owner_haras_id, avaliacao_id, tipo)
  values (v_haras, p_avaliacao, p_tipo)
  on conflict (avaliacao_id, tipo) do update
     set situacao = 'na_fila',
         tentativas = 0,
         erro = null,
         iniciado_em = null,
         concluido_em = null
   where public.morfologia_tarefas.situacao in ('falhou', 'concluida')
  returning id into v_id;

  -- O `where` acima não casou: a tarefa está na fila ou em curso. Devolve a
  -- que está lá em vez de estourar — quem chamou queria garantir que existe.
  if v_id is null then
    select id into v_id from public.morfologia_tarefas
     where avaliacao_id = p_avaliacao and tipo = p_tipo;
  end if;

  return v_id;
end $$;

-- ====================================================== pegar tarefa

/*
  Entrega UMA tarefa e já manda junto o que processar.

  Devolver a tarefa e depois o trabalhador vir buscar as mídias seria uma
  segunda viagem para nada: quem pega PROCESSAR_MIDIA sempre quer os vídeos
  daquela avaliação. Vai tudo num JSON só.

  Só vídeo ACEITO e não substituído entra. Foto não passa por aqui — ela já
  é o quadro.
*/
create or replace function public.morfologia_tarefa_pegar(
  p_tipo text, p_tentativas_max int default 3
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v json;
begin
  update public.morfologia_tarefas t
     set situacao = 'processando',
         tentativas = t.tentativas + 1,
         iniciado_em = now()
   where t.id = (
     select f.id from public.morfologia_tarefas f
      where f.tipo = p_tipo
        and f.situacao = 'na_fila'
        and f.tentativas < p_tentativas_max
      order by f.criado_em
      limit 1
      for update skip locked
   )
  returning json_build_object(
    'tarefa_id', t.id,
    'avaliacao_id', t.avaliacao_id,
    'haras_id', t.owner_haras_id,
    'tentativa', t.tentativas,
    'videos', coalesce((
      select json_agg(json_build_object(
               'midia_id', m.id,
               'papel', m.papel,
               'caminho', m.caminho,
               /* Onde os quadros deste vídeo devem ser gravados. Vai pronto
                  para o trabalhador não ter de repetir a convenção em outra
                  linguagem — ele só acrescenta o nome do arquivo. */
               'prefixo_quadros', public.morfologia_caminho(
                  t.owner_haras_id, t.avaliacao_id, 'quadros/' || m.id::text || '/')
             ) order by m.papel)
        from public.morfologia_midias m
       where m.avaliacao_id = t.avaliacao_id
         and m.tipo = 'video'
         and m.validacao = 'ACEITA'
         and not m.substituida
    ), '[]'::json)
  ) into v;

  return coalesce(v, json_build_object('tarefa_id', null));
end $$;

/** Fecha a tarefa. Falha guarda o motivo — tentativa 3 vira falha definitiva. */
create or replace function public.morfologia_tarefa_concluir(
  p_id uuid, p_ok boolean, p_erro text default null
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  update public.morfologia_tarefas
     set situacao = case when p_ok then 'concluida' else 'falhou' end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'erro sem descrição'), 2000) end,
         concluido_em = now()
   where id = p_id;
  return found;
end $$;

/*
  Devolve à fila o que ficou preso.

  Trabalhador que morre no meio (deploy, estouro de memória, queda) deixa a
  tarefa em 'processando' para sempre. Quinze minutos é folgado para um vídeo
  de trinta segundos e curto o bastante para o dono não ficar esperando.
*/
create or replace function public.morfologia_destravar_tarefas(
  p_minutos int default 15
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
  update public.morfologia_tarefas
     set situacao = 'na_fila', iniciado_em = null
   where situacao = 'processando'
     and iniciado_em < now() - make_interval(mins => p_minutos);
  get diagnostics n = row_count;
  return n;
end $$;

-- ====================================================== quadros

/*
  O que o FFmpeg mediu sobre o vídeo.

  Duração e dimensão só se conhecem abrindo o arquivo, e quem abre é o
  trabalhador. A validação de mídia (vídeo curto demais, vertical demais)
  depende destes números.
*/
create or replace function public.morfologia_midia_medidas(
  p_midia uuid,
  p_duracao numeric default null,
  p_largura int default null,
  p_altura int default null
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  update public.morfologia_midias
     set duracao_seg = coalesce(p_duracao, duracao_seg),
         largura = coalesce(p_largura, largura),
         altura = coalesce(p_altura, altura)
   where id = p_midia;
  return found;
end $$;

/*
  Grava um quadro escolhido.

  Reprocessar não pode empilhar quadro: a chave é (mídia, segundo). Se o
  mesmo instante voltar, ele é atualizado, não duplicado — senão a segunda
  tentativa de uma tarefa que falhou no meio dobraria o material da análise.
*/
create unique index if not exists morfologia_frames_unico
  on public.morfologia_frames (midia_id, segundo);

create or replace function public.morfologia_frame_registrar(
  p_midia uuid,
  p_segundo numeric,
  p_caminho text,
  p_nitidez numeric default null,
  p_selecionado boolean default true,
  p_motivo_descarte text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_aval uuid;
  v_id uuid;
begin
  select owner_haras_id, avaliacao_id into v_haras, v_aval
    from public.morfologia_midias where id = p_midia;
  if v_haras is null then
    raise exception 'Mídia % não existe.', p_midia;
  end if;

  insert into public.morfologia_frames
    (owner_haras_id, midia_id, avaliacao_id, segundo, caminho, nitidez,
     selecionado, motivo_descarte)
  values
    (v_haras, p_midia, v_aval, p_segundo, p_caminho, p_nitidez,
     p_selecionado, p_motivo_descarte)
  on conflict (midia_id, segundo) do update
     set caminho = excluded.caminho,
         nitidez = excluded.nitidez,
         selecionado = excluded.selecionado,
         motivo_descarte = excluded.motivo_descarte
  returning id into v_id;

  return v_id;
end $$;

/*
  Apaga os quadros de uma mídia antes de extrair de novo.

  Sem isto, mudar a regra de seleção deixaria os quadros antigos misturados
  com os novos na mesma avaliação. O arquivo no balde é sobrescrito pelo
  caminho determinístico; a linha some aqui.
*/
create or replace function public.morfologia_frames_limpar(p_midia uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.morfologia_frames where midia_id = p_midia;
  get diagnostics n = row_count;
  return n;
end $$;

-- ====================================================== fechamento de acesso
--
-- Tudo aqui é do service_role. O trabalhador usa a chave de serviço; a tela
-- não chama nenhuma destas. Função em `public` nasce executável por todos —
-- 021 já tratou disso como padrão, mas repetir explicitamente sai barato e
-- não depende de lembrar.

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_enfileirar(uuid, text)',
    'public.morfologia_tarefa_pegar(text, int)',
    'public.morfologia_tarefa_concluir(uuid, boolean, text)',
    'public.morfologia_destravar_tarefas(int)',
    'public.morfologia_midia_medidas(uuid, numeric, int, int)',
    'public.morfologia_frame_registrar(uuid, numeric, text, numeric, boolean, text)',
    'public.morfologia_frames_limpar(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
