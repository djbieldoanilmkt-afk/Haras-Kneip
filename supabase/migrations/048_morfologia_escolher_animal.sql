-- 048 — A parte conversada do roteiro: de quem é a avaliação.
--
-- A 042 escreveu o texto dos nove pedidos de foto e vídeo, mas deixou mudos os
-- estados anteriores. Na prática isso significa que o agente abria a avaliação
-- e não dizia nada — o roteiro começava no meio.
--
-- POR QUE O ANIMAL PODE NÃO SER DO PLANTEL
--
-- O caso mais valioso do módulo é avaliar cavalo de terceiro antes de comprar.
-- Exigir animal cadastrado mataria justamente esse uso. Então há dois
-- caminhos: o do plantel, que já tem sexo e idade na ficha, e o de fora, que
-- precisa perguntar.
--
-- POR QUE CONFIRMAR
--
-- Avaliar o cavalo errado só aparece no laudo, depois de meia hora de campo
-- com o animal parado e boa luz. Quando o nome bate exato, segue direto;
-- quando é palpite, pergunta. Uma pergunta é mais barata que uma coleta.

begin;

-- ====================================================== o que dizer em cada estado
--
-- A função inteira é reescrita porque um CASE não se estende pela metade. Os
-- nove textos de mídia são os mesmos da 042, palavra por palavra.

create or replace function public.morfologia_instrucao(p_estado text)
returns text
language sql immutable
as $$
  select case p_estado
    when 'ESCOLHER_ANIMAL' then
      E'🐴 Vamos avaliar a morfologia.\n\n' ||
      E'De qual animal? Se for do plantel, é só o nome.\n\n' ||
      E'Se for um cavalo de fora — de visita, ou que você está pensando em comprar — ' ||
      E'me diga o nome dele do mesmo jeito que eu pergunto o resto.'
    when 'CONFIRMAR_ANIMAL' then
      E'É esse animal mesmo? Responda *sim* ou me diga o nome certo.'
    when 'COLETAR_DADOS' then
      E'Esse não é do plantel, então me conte duas coisas sobre ele:\n\n' ||
      E'*é macho ou fêmea* e *que idade tem*.\n\n' ||
      E'Pode responder de uma vez: "macho, 4 anos".'
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
    when 'PRONTA_PARA_PROCESSAR' then
      E'✅ Material completo. Já estou processando.\n\n' ||
      E'Vou extrair os quadros dos vídeos e analisar região por região. ' ||
      E'Quando o laudo estiver pronto eu te mando aqui — pode fechar o WhatsApp.'
  end
$$;

-- ====================================================== quem está sendo avaliado

/*
  Define (ou troca) o animal da avaliação e devolve o próximo passo.

  Apaga e grava de novo em vez de atualizar campo a campo: trocar de animal no
  meio deixaria a idade do anterior colada no novo, e idade é o que decide se
  as regras de animal jovem valem. Registro meio antigo e meio novo é pior que
  registro novo.
*/
create or replace function public.morfologia_definir_sujeito(
  p_telefone text,
  p_animal_id uuid default null,
  p_nome text default null,
  p_sexo text default null,
  p_idade_meses int default null,
  p_confirmado boolean default true
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_aval uuid;
  v_nome text;
  v_sexo text;
  v_nasc date;
  v_idade int;
  v_tipo text;
  v_estado text;
  r json;
begin
  select s.owner_haras_id, s.avaliacao_id into v_haras, v_aval
    from public.morfologia_sessoes s
    join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
   where s.telefone = p_telefone
     and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU');

  if v_aval is null then
    raise exception 'Não há avaliação morfológica aberta para %.', p_telefone;
  end if;

  v_tipo := case when p_animal_id is null then 'ANIMAL_EXTERNO' else 'ANIMAL_CADASTRADO' end;
  v_nome := p_nome;
  v_sexo := p_sexo;
  v_idade := p_idade_meses;

  /*
    Animal do plantel não precisa ser perguntado: sexo e nascimento já estão na
    ficha, e perguntar o que o sistema sabe é o tipo de atrito que faz o dono
    desistir no meio.
  */
  if p_animal_id is not null then
    select a.nome, a.sexo, a.data_nascimento into v_nome, v_sexo, v_nasc
      from public.animais a
     where a.id = p_animal_id and a.haras_id = v_haras;

    if v_nome is null then
      raise exception 'Animal % não é deste haras.', p_animal_id;
    end if;

    if v_nasc is not null then
      v_idade := (extract(year from age(current_date, v_nasc)) * 12
                  + extract(month from age(current_date, v_nasc)))::int;
    end if;
  end if;

  delete from public.morfologia_sujeitos where avaliacao_id = v_aval;

  insert into public.morfologia_sujeitos
    (owner_haras_id, avaliacao_id, tipo, animal_id, nome, raca, sexo,
     data_nascimento, idade_meses_na_avaliacao)
  values
    (v_haras, v_aval, v_tipo, p_animal_id, coalesce(v_nome, 'Sem nome'),
     'Mangalarga Marchador', v_sexo, v_nasc, v_idade);

  update public.morfologia_sessoes set atualizado_em = now() where telefone = p_telefone;

  if not p_confirmado then
    v_estado := 'CONFIRMAR_ANIMAL';
  elsif v_tipo = 'ANIMAL_EXTERNO' and (v_sexo is null or v_idade is null) then
    /* Sexo e idade não são enfeite: as regras de animal jovem mudam a leitura
       de garupa e de aprumo, e sem a idade não dá para saber se elas valem. */
    v_estado := 'COLETAR_DADOS';
  end if;

  if v_estado is not null then
    update public.morfologia_avaliacoes
       set estado = v_estado, atualizado_em = now() where id = v_aval;
    return json_build_object(
      'ok', true, 'animal', v_nome, 'estado', v_estado,
      'instrucao', case when v_estado = 'CONFIRMAR_ANIMAL'
        then format(E'É o *%s* mesmo?\n\nResponda *sim*, ou me diga o nome certo.', v_nome)
        else public.morfologia_instrucao(v_estado) end,
      'completo', false);
  end if;

  r := public.morfologia_avancar(v_aval);
  return json_build_object(
    'ok', true, 'animal', v_nome,
    'estado', r->>'estado', 'instrucao', r->>'instrucao',
    'completo', (r->>'completo')::boolean);
end $$;

/*
  "Sim, é esse": segue com o que já está gravado.

  Existe em vez de mandar `morfologia_definir_sujeito` de novo porque aquela
  apaga e regrava. Um "sim" não deveria reescrever registro nenhum — e se o
  agente tivesse de reenviar os dados do animal para confirmar, bastaria ele
  reenviar errado para a confirmação gravar outra coisa.
*/
create or replace function public.morfologia_confirmar_sujeito(p_telefone text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_aval uuid;
  v_tipo text; v_sexo text; v_idade int; v_nome text;
  r json;
begin
  select s.avaliacao_id into v_aval
    from public.morfologia_sessoes s
    join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
   where s.telefone = p_telefone
     and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU');

  if v_aval is null then
    raise exception 'Não há avaliação morfológica aberta para %.', p_telefone;
  end if;

  select tipo, sexo, idade_meses_na_avaliacao, nome
    into v_tipo, v_sexo, v_idade, v_nome
    from public.morfologia_sujeitos where avaliacao_id = v_aval;

  if v_tipo is null then
    raise exception 'Não há animal escolhido para confirmar.';
  end if;

  if v_tipo = 'ANIMAL_EXTERNO' and (v_sexo is null or v_idade is null) then
    update public.morfologia_avaliacoes
       set estado = 'COLETAR_DADOS', atualizado_em = now() where id = v_aval;
    return json_build_object('ok', true, 'animal', v_nome, 'estado', 'COLETAR_DADOS',
      'instrucao', public.morfologia_instrucao('COLETAR_DADOS'), 'completo', false);
  end if;

  r := public.morfologia_avancar(v_aval);
  return json_build_object('ok', true, 'animal', v_nome,
    'estado', r->>'estado', 'instrucao', r->>'instrucao',
    'completo', (r->>'completo')::boolean);
end $$;

/** "Não é esse": volta para a escolha sem deixar meio-registro para trás. */
create or replace function public.morfologia_descartar_sujeito(p_telefone text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare v_aval uuid;
begin
  select s.avaliacao_id into v_aval
    from public.morfologia_sessoes s
    join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
   where s.telefone = p_telefone
     and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU');

  if v_aval is null then
    raise exception 'Não há avaliação morfológica aberta para %.', p_telefone;
  end if;

  delete from public.morfologia_sujeitos where avaliacao_id = v_aval;
  update public.morfologia_avaliacoes
     set estado = 'ESCOLHER_ANIMAL', atualizado_em = now() where id = v_aval;

  return json_build_object('ok', true, 'estado', 'ESCOLHER_ANIMAL',
    'instrucao', public.morfologia_instrucao('ESCOLHER_ANIMAL'), 'completo', false);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_definir_sujeito(text, uuid, text, text, int, boolean)',
    'public.morfologia_confirmar_sujeito(text)',
    'public.morfologia_descartar_sujeito(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
