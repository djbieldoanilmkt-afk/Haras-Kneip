-- 042 — O condutor da avaliação: máquina de estados no BANCO.
--
-- A especificação foi categórica: "o LLM NÃO deve controlar sozinho em qual
-- etapa estamos". Concordo, e o motivo é prático: o modelo esquece, se
-- confunde com mensagem fora de ordem, e reinicia o roteiro do zero — depois
-- de a pessoa já ter mandado cinco fotos.
--
-- Aqui o estado é uma linha. O modelo lê texto e extrai dados; quem decide o
-- que vem a seguir é a função. O fluxo sobrevive a reinício do servidor,
-- porque nunca esteve na memória de ninguém.
--
-- RETOMADA: a sessão não expira. "Mando as fotos amanhã" é o caso normal numa
-- coleta que exige o cavalo parado em piso plano e boa luz — não a exceção.

begin;

/** Sem acento e sem caixa, para comparar nome falado com nome cadastrado. */
create or replace function public.sem_acento(p_texto text)
returns text
language sql immutable
as $$
  select translate(coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

/** A ordem do roteiro. Mudou aqui, mudou no fluxo inteiro. */
create or replace function public.morfologia_ordem()
returns text[]
language sql immutable
as $$
  select array[
    'PEDIR_LATERAL_ESQ', 'PEDIR_LATERAL_DIR', 'PEDIR_FRENTE', 'PEDIR_TRASEIRA',
    'PEDIR_CABECA_FRENTE', 'PEDIR_CABECA_PERFIL',
    'PEDIR_VIDEO_360', 'PEDIR_VIDEO_FRENTE_TRAS', 'PEDIR_VIDEO_LATERAL'
  ]
$$;

/** Estado de pedido -> papel da mídia correspondente. */
create or replace function public.morfologia_papel_do_estado(p_estado text)
returns text
language sql immutable
as $$
  select case p_estado
    when 'PEDIR_LATERAL_ESQ'      then 'LATERAL_ESQ'
    when 'PEDIR_LATERAL_DIR'      then 'LATERAL_DIR'
    when 'PEDIR_FRENTE'           then 'FRENTE'
    when 'PEDIR_TRASEIRA'         then 'TRASEIRA'
    when 'PEDIR_CABECA_FRENTE'    then 'CABECA_FRENTE'
    when 'PEDIR_CABECA_PERFIL'    then 'CABECA_PERFIL'
    when 'PEDIR_VIDEO_360'        then 'VIDEO_360'
    when 'PEDIR_VIDEO_FRENTE_TRAS' then 'VIDEO_FRENTE_TRAS'
    when 'PEDIR_VIDEO_LATERAL'    then 'VIDEO_LATERAL'
  end
$$;

/** O texto que ensina a tirar cada foto/vídeo. */
create or replace function public.morfologia_instrucao(p_estado text)
returns text
language sql immutable
as $$
  select case p_estado
    when 'PEDIR_LATERAL_ESQ' then
      E'📸 Vamos começar pelas fotos. Mando uma de cada vez e confiro antes de seguir.\n\n' ||
      E'*1 de 6 — lado esquerdo*\n\n' ||
      E'O animal precisa aparecer inteiro: orelhas em cima, cascos embaixo, parado em piso plano.\n\n' ||
      E'Fique com a câmera mais ou menos na altura do meio do tronco e use a lente 1x.'
    when 'PEDIR_LATERAL_DIR' then
      E'*2 de 6 — lado direito*\n\n' ||
      E'Agora o outro lado, mantendo mais ou menos a mesma distância e a mesma altura de câmera.'
    when 'PEDIR_FRENTE' then
      E'*3 de 6 — de frente*\n\n' ||
      E'Corpo inteiro, de frente. Preciso enxergar o peito, os membros da frente e os cascos.'
    when 'PEDIR_TRASEIRA' then
      E'*4 de 6 — por trás*\n\n' ||
      E'Animal inteiro, visto de trás. Garupa, jarretes, membros posteriores e cascos precisam aparecer.'
    when 'PEDIR_CABECA_FRENTE' then
      E'*5 de 6 — cabeça de frente*\n\n' ||
      E'Aproxime um pouco e fotografe a cabeça de frente.'
    when 'PEDIR_CABECA_PERFIL' then
      E'*6 de 6 — cabeça de perfil*\n\n' ||
      E'Última foto: cabeça de perfil, mostrando também a ligação com o pescoço.'
    when 'PEDIR_VIDEO_360' then
      E'🎥 Fotos prontas. Agora três vídeos.\n\n' ||
      E'*1 de 3 — volta completa*\n\n' ||
      E'Deixe o animal parado e caminhe devagar ao redor dele, dando uma volta inteira: ' ||
      E'comece numa lateral, passe pela frente, pela outra lateral, pela traseira e volte.\n\n' ||
      E'Mantenha o animal inteiro no enquadramento. De 25 a 40 segundos.'
    when 'PEDIR_VIDEO_FRENTE_TRAS' then
      E'*2 de 3 — indo e voltando*\n\n' ||
      E'Agora preciso ver os membros em movimento.\n\n' ||
      E'Com a câmera parada, caminhe com o animal uns 10 a 15 metros em direção a ela. ' ||
      E'Continue gravando enquanto ele se afasta, em linha reta.'
    when 'PEDIR_VIDEO_LATERAL' then
      E'*3 de 3 — passando de lado*\n\n' ||
      E'Último vídeo: filme o animal passando lateralmente pela câmera, em linha reta, ' ||
      E'primeiro num sentido e depois no outro.'
  end
$$;

/** Rótulo curto, para listar o que falta. */
create or replace function public.morfologia_rotulo(p_papel text)
returns text
language sql immutable
as $$
  select case p_papel
    when 'LATERAL_ESQ'       then 'foto do lado esquerdo'
    when 'LATERAL_DIR'       then 'foto do lado direito'
    when 'FRENTE'            then 'foto de frente'
    when 'TRASEIRA'          then 'foto de trás'
    when 'CABECA_FRENTE'     then 'foto da cabeça de frente'
    when 'CABECA_PERFIL'     then 'foto da cabeça de perfil'
    when 'VIDEO_360'         then 'vídeo da volta completa'
    when 'VIDEO_FRENTE_TRAS' then 'vídeo indo e voltando'
    when 'VIDEO_LATERAL'     then 'vídeo passando de lado'
    else p_papel
  end
$$;

-- ==================================================== iniciar / retomar

/*
  Abre uma avaliação, ou devolve a que já estava em andamento.

  Nunca reinicia sozinho: quem mandou cinco fotos ontem e diz "vamos avaliar
  um cavalo" hoje quase sempre quer CONTINUAR. Recomeçar jogaria fora o
  trabalho de campo — que é caro, porque exige o cavalo parado e boa luz.
*/
create or replace function public.morfologia_iniciar(p_user uuid, p_telefone text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_aval uuid;
  v_estado text;
  v_nome text;
begin
  if not public.pode_morfologia(p_user, 'criar') then
    return json_build_object('ok', false,
      'mensagem', 'A avaliação morfológica não está liberada para este haras.');
  end if;

  select haras_id into v_haras from public.membros where user_id = p_user;

  -- Já havia algo em andamento?
  select s.avaliacao_id, a.estado into v_aval, v_estado
    from public.morfologia_sessoes s
    join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
   where s.telefone = p_telefone
     and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU');

  if v_aval is not null then
    select nome into v_nome from public.morfologia_sujeitos where avaliacao_id = v_aval;
    return json_build_object('ok', true, 'retomada', true,
      'avaliacao_id', v_aval, 'estado', v_estado, 'animal', v_nome);
  end if;

  insert into public.morfologia_avaliacoes
    (owner_haras_id, criado_por, estado, origem,
     protocolo_id)
  values
    (v_haras, p_user, 'ESCOLHER_ANIMAL', 'whatsapp',
     (select id from public.morfologia_protocolos
       where raca = 'Mangalarga Marchador'
       order by case situacao when 'vigente' then 0 else 1 end, versao desc limit 1))
  returning id into v_aval;

  insert into public.morfologia_sessoes (telefone, owner_haras_id, avaliacao_id, user_id)
  values (p_telefone, v_haras, v_aval, p_user)
  on conflict (telefone) do update set
    owner_haras_id = excluded.owner_haras_id,
    avaliacao_id = excluded.avaliacao_id,
    user_id = excluded.user_id,
    atualizado_em = now();

  return json_build_object('ok', true, 'retomada', false,
    'avaliacao_id', v_aval, 'estado', 'ESCOLHER_ANIMAL');
end $$;

/** Onde estamos, e o que falta. Uma leitura só, para o agente se situar. */
create or replace function public.morfologia_situacao(p_telefone text)
returns json
language sql stable security definer
set search_path = public
as $$
  select case when s.telefone is null then json_build_object('ativa', false)
  else json_build_object(
    'ativa', true,
    'avaliacao_id', a.id,
    'estado', a.estado,
    'animal', su.nome,
    'animal_id', su.animal_id,
    'tipo_sujeito', su.tipo,
    'sujeito', to_jsonb(su.*) - 'instantaneo',
    'aceitas', coalesce((
      select json_agg(m.papel order by m.criado_em)
        from public.morfologia_midias m
       where m.avaliacao_id = a.id and m.validacao = 'ACEITA' and not m.substituida
    ), '[]'::json),
    'faltando', coalesce((
      select json_agg(public.morfologia_rotulo(public.morfologia_papel_do_estado(e)))
        from unnest(public.morfologia_ordem()) e
       where not exists (
         select 1 from public.morfologia_midias m
          where m.avaliacao_id = a.id
            and m.papel = public.morfologia_papel_do_estado(e)
            and m.validacao = 'ACEITA' and not m.substituida)
    ), '[]'::json),
    'instrucao', public.morfologia_instrucao(a.estado)
  ) end
  from public.morfologia_sessoes s
  join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
  left join public.morfologia_sujeitos su on su.avaliacao_id = a.id
  where s.telefone = p_telefone
    and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU')
$$;

/*
  O próximo estado sai do que JÁ FOI ACEITO, não de um contador.

  Contador quebra quando a pessoa reenvia uma foto, pula, ou manda fora de
  ordem. Perguntar ao banco "qual a primeira peça que ainda falta?" funciona
  em qualquer ordem de chegada — e é o que permite retomar amanhã.
*/
create or replace function public.morfologia_proximo_estado(p_aval uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select e from unnest(public.morfologia_ordem()) e
      where not exists (
        select 1 from public.morfologia_midias m
         where m.avaliacao_id = p_aval
           and m.papel = public.morfologia_papel_do_estado(e)
           and m.validacao = 'ACEITA' and not m.substituida)
      limit 1),
    'PRONTA_PARA_PROCESSAR')
$$;

/** Move a avaliação para o estado que o material atual determina. */
create or replace function public.morfologia_avancar(p_aval uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare v_novo text;
begin
  v_novo := public.morfologia_proximo_estado(p_aval);
  update public.morfologia_avaliacoes
     set estado = v_novo, atualizado_em = now()
   where id = p_aval;

  return json_build_object(
    'estado', v_novo,
    'instrucao', public.morfologia_instrucao(v_novo),
    'completo', v_novo = 'PRONTA_PARA_PROCESSAR');
end $$;

/** Encerra o que estiver em andamento para este telefone. */
create or replace function public.morfologia_cancelar(p_telefone text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare v_aval uuid;
begin
  select avaliacao_id into v_aval from public.morfologia_sessoes where telefone = p_telefone;
  if v_aval is null then return false; end if;

  update public.morfologia_avaliacoes
     set estado = 'CANCELADA', atualizado_em = now()
   where id = v_aval and estado not in ('CONCLUIDA', 'FALHOU');

  delete from public.morfologia_sessoes where telefone = p_telefone;
  return true;
end $$;

-- ==================================================== identificar o animal

/*
  Procura o animal SÓ dentro do haras de quem pergunta.

  Três camadas, da certeza para a suspeita: igual, sem acento, e parecido.
  A similaridade nunca vincula sozinha — devolve candidato para a pessoa
  confirmar. Vincular por palpite trocaria o animal da avaliação, e o erro só
  apareceria no laudo.
*/
create or replace function public.morfologia_buscar_animal(p_user uuid, p_nome text)
returns table (id uuid, nome text, sexo text, data_nascimento date, exato boolean)
language sql stable security definer
set search_path = public
as $$
  with meu as (
    select a.id, a.nome, a.sexo, a.data_nascimento,
           lower(public.sem_acento(a.nome)) as chave
    from public.animais a
    join public.membros m on m.haras_id = a.haras_id
    where m.user_id = p_user and a.ativo and not a.externo
  ), alvo as (
    select lower(public.sem_acento(btrim(p_nome))) as chave
  )
  select m.id, m.nome, m.sexo, m.data_nascimento,
         (m.chave = (select chave from alvo)) as exato
  from meu m, alvo
  where m.chave = alvo.chave
     or m.chave like '%' || alvo.chave || '%'
     or alvo.chave like '%' || m.chave || '%'
  order by (m.chave = alvo.chave) desc, length(m.nome)
  limit 5
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'morfologia_iniciar(uuid, text)',
    'morfologia_situacao(text)',
    'morfologia_proximo_estado(uuid)',
    'morfologia_avancar(uuid)',
    'morfologia_cancelar(text)',
    'morfologia_buscar_animal(uuid, text)',
    'morfologia_ordem()',
    'morfologia_papel_do_estado(text)',
    'morfologia_instrucao(text)',
    'morfologia_rotulo(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

grant execute on function public.sem_acento(text) to authenticated, service_role;

commit;
