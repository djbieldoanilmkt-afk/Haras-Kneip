-- 060 — A avaliação morfológica também pelo site.
--
-- O módulo nasceu inteiro pelo WhatsApp: o agente conduz, o service_role
-- grava. Quem abre o painel no computador não tem como começar uma avaliação,
-- nem ver as que estão em andamento. A tela lê as tabelas (a 039 já deu
-- `select` ao autenticado) mas não tem por onde ESCREVER — e o comentário lá
-- dizia, desde o começo, "a tela lê e dispara por função; não insere direto".
-- Estas são as funções.
--
-- POR QUE NÃO REAPROVEITAR AS DO WHATSAPP
--
-- Elas são chaveadas por TELEFONE: acham a avaliação pela sessão aberta
-- daquele número. No site não há telefone, há um usuário logado. O que muda é
-- só como se descobre de que avaliação se está falando — então o miolo, que é
-- a parte que erra feio se divergir, virou função compartilhada e as duas
-- portas chamam a mesma.
--
-- E É A MESMA AVALIAÇÃO
--
-- Uma avaliação aberta no site aparece no WhatsApp e vice-versa: mesmos
-- estados, mesma fila, mesmo laudo. Dá para começar as fotos no curral, pelo
-- telefone, e terminar no escritório — ou o contrário. Duas filas paralelas
-- para a mesma coisa seria a maneira mais rápida de ter dois laudos
-- divergentes do mesmo cavalo.
--
-- SECURITY DEFINER EXIGE CONFERIR O HARAS NA MÃO
--
-- Estas funções passam por cima do RLS por construção. Cada uma confere
-- `meu_haras_id()` explicitamente: sem isso, qualquer pessoa logada abriria
-- avaliação sobre o cavalo de qualquer outro haras.

begin;

-- ====================================================== a conta da idade

/*
  Idade em meses, que é o que decide se valem as regras de animal jovem.

  Gêmea da conta embutida em `morfologia_definir_sujeito` (048). Quando aquela
  for mexida, esta vem junto — são a mesma regra vista de duas portas.
*/
create or replace function public.morfologia_idade_meses(p_nasc date)
returns int
language sql stable
as $$
  select case when p_nasc is null then null else
    (extract(year from age(current_date, p_nasc)) * 12
     + extract(month from age(current_date, p_nasc)))::int
  end
$$;

-- ====================================================== miolo de gravar mídia

/*
  Grava uma peça do material e move a avaliação. Não sabe quem mandou.

  Saiu de dentro de `morfologia_registrar_midia` para que a porta do site e a
  do WhatsApp gravem pela mesma regra: o que substitui o quê, quando a
  avaliação avança e quando o material fechado entra na fila.
*/
create or replace function public.morfologia_gravar_midia(
  p_avaliacao uuid,
  p_papel text,
  p_caminho text,
  p_mime text,
  p_bytes bigint,
  p_validacao text,
  p_codigos text[] default '{}',
  p_observacao text default null,
  p_largura int default null,
  p_altura int default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_id uuid;
  v_substituiu boolean := false;
  r json;
begin
  select owner_haras_id into v_haras
    from public.morfologia_avaliacoes where id = p_avaliacao;
  if v_haras is null then
    raise exception 'Avaliação % não existe.', p_avaliacao;
  end if;

  /*
    Só o que serve aposenta o que já estava lá.

    O dono tem uma lateral boa gravada e manda, por engano, um vídeo naquele
    passo. Se a recusa aposentasse a anterior, ele perderia a foto boa por
    causa do próprio engano — e o roteiro voltaria a pedir o que já tinha.
  */
  if public.morfologia_midia_serve(p_validacao) then
    update public.morfologia_midias
       set substituida = true
     where avaliacao_id = p_avaliacao
       and papel = p_papel
       and not substituida;
    v_substituiu := found;
  end if;

  insert into public.morfologia_midias
    (owner_haras_id, avaliacao_id, papel, tipo, caminho, mime, bytes,
     largura, altura, validacao, codigos_problema, observacao_validacao)
  values
    (v_haras, p_avaliacao, p_papel,
     case when p_papel like 'VIDEO%' then 'video' else 'foto' end,
     p_caminho, p_mime, p_bytes, p_largura, p_altura,
     p_validacao, coalesce(p_codigos, '{}'), p_observacao)
  returning id into v_id;

  r := public.morfologia_avancar(p_avaliacao);

  /*
    Material fechado enfileira sozinho, na mesma transação da última peça: uma
    queda entre "gravei a última foto" e "pedi o processamento" deixaria a
    avaliação pronta e parada, esperando alguém perceber.
  */
  if (r->>'completo')::boolean then
    perform public.morfologia_enfileirar(p_avaliacao, 'PROCESSAR_MIDIA');
  end if;

  return json_build_object(
    'ok', true,
    'midia_id', v_id,
    'papel', p_papel,
    'rotulo', public.morfologia_rotulo(p_papel),
    'validacao', p_validacao,
    'substituiu', v_substituiu,
    'estado', r->>'estado',
    'instrucao', r->>'instrucao',
    'completo', (r->>'completo')::boolean);
end $$;

/* A porta do WhatsApp: acha a avaliação pelo telefone e delega. */
create or replace function public.morfologia_registrar_midia(
  p_telefone text,
  p_papel text,
  p_caminho text,
  p_mime text,
  p_bytes bigint,
  p_validacao text,
  p_codigos text[] default '{}',
  p_observacao text default null,
  p_largura int default null,
  p_altura int default null
)
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

  update public.morfologia_sessoes set atualizado_em = now() where telefone = p_telefone;

  return public.morfologia_gravar_midia(
    v_aval, p_papel, p_caminho, p_mime, p_bytes, p_validacao,
    p_codigos, p_observacao, p_largura, p_altura);
end $$;

-- ====================================================== a porta do site

/* O haras de quem está pedindo, com o recurso ligado. Ou estoura. */
create or replace function public.morfologia_meu_haras()
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare v_haras uuid;
begin
  v_haras := public.meu_haras_id();
  if v_haras is null then
    raise exception 'É preciso estar em um haras para usar a avaliação morfológica.';
  end if;
  if not public.tem_recurso('avaliacao_morfologica') then
    raise exception 'A avaliação morfológica não está liberada para este haras.';
  end if;
  return v_haras;
end $$;

/*
  Abre a avaliação de um animal do plantel — ou devolve a que já estava aberta.

  Retomar não é conveniência: material de campo é caro. Exige o cavalo parado,
  piso plano e luz boa. Quem já subiu cinco fotos e clica de novo no botão
  quase sempre quer continuar, e abrir uma segunda avaliação dividiria as
  fotos entre as duas — nenhuma das quais fecharia.
*/
create or replace function public.morfologia_app_abrir(
  p_animal uuid,
  p_finalidade text default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid := public.morfologia_meu_haras();
  v_aval uuid;
  v_prot uuid;
  v_nome text; v_sexo text; v_nasc date;
  r json;
begin
  select a.nome, a.sexo, a.data_nascimento into v_nome, v_sexo, v_nasc
    from public.animais a
   where a.id = p_animal and a.haras_id = v_haras and a.ativo;
  if v_nome is null then
    raise exception 'Animal % não é deste haras.', p_animal;
  end if;

  select a.id into v_aval
    from public.morfologia_avaliacoes a
    join public.morfologia_sujeitos s on s.avaliacao_id = a.id
   where a.owner_haras_id = v_haras
     and s.animal_id = p_animal
     and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU')
   order by a.iniciada_em desc
   limit 1;

  if v_aval is not null then
    r := public.morfologia_avancar(v_aval);
    return json_build_object(
      'ok', true, 'retomada', true, 'avaliacao_id', v_aval, 'animal', v_nome,
      'estado', r->>'estado', 'completo', (r->>'completo')::boolean);
  end if;

  select p.id into v_prot from public.morfologia_protocolos p
   where p.raca = 'Mangalarga Marchador'
   order by (p.situacao = 'vigente') desc, p.versao desc
   limit 1;

  insert into public.morfologia_avaliacoes
    (owner_haras_id, protocolo_id, estado, origem, finalidade, criado_por)
  values (v_haras, v_prot, 'INICIADA', 'app', p_finalidade, auth.uid())
  returning id into v_aval;

  insert into public.morfologia_sujeitos
    (owner_haras_id, avaliacao_id, tipo, animal_id, nome, raca, sexo,
     data_nascimento, idade_meses_na_avaliacao)
  values
    (v_haras, v_aval, 'ANIMAL_CADASTRADO', p_animal, v_nome,
     'Mangalarga Marchador', v_sexo, v_nasc, public.morfologia_idade_meses(v_nasc));

  r := public.morfologia_avancar(v_aval);
  return json_build_object(
    'ok', true, 'retomada', false, 'avaliacao_id', v_aval, 'animal', v_nome,
    'estado', r->>'estado', 'completo', (r->>'completo')::boolean);
end $$;

/* A avaliação existe, é deste haras e ainda aceita mudança. Ou estoura. */
create or replace function public.morfologia_minha_avaliacao(p_aval uuid, p_aberta boolean default true)
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare v_haras uuid := public.morfologia_meu_haras(); v_dono uuid; v_estado text;
begin
  select owner_haras_id, estado into v_dono, v_estado
    from public.morfologia_avaliacoes where id = p_aval;
  if v_dono is null or v_dono <> v_haras then
    raise exception 'Avaliação % não é deste haras.', p_aval;
  end if;
  if p_aberta and v_estado in ('CONCLUIDA', 'CANCELADA', 'FALHOU') then
    raise exception 'Esta avaliação já está %.', lower(v_estado);
  end if;
  return p_aval;
end $$;

/* Grava uma peça enviada pelo site. O arquivo já subiu direto para o balde. */
create or replace function public.morfologia_app_registrar(
  p_avaliacao uuid,
  p_papel text,
  p_caminho text,
  p_mime text,
  p_bytes bigint,
  p_validacao text,
  p_codigos text[] default '{}',
  p_observacao text default null,
  p_largura int default null,
  p_altura int default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.morfologia_minha_avaliacao(p_avaliacao);
  return public.morfologia_gravar_midia(
    p_avaliacao, p_papel, p_caminho, p_mime, p_bytes, p_validacao,
    p_codigos, p_observacao, p_largura, p_altura);
end $$;

/*
  Desiste da avaliação, e tira da fila junto.

  Só marcar CANCELADA deixaria a tarefa esperando: o cron pegaria, mandaria o
  material para o modelo de visão e cobraria a análise de algo que o dono já
  tinha desistido de fazer.
*/
create or replace function public.morfologia_app_cancelar(p_avaliacao uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.morfologia_minha_avaliacao(p_avaliacao);

  update public.morfologia_avaliacoes
     set estado = 'CANCELADA', atualizado_em = now()
   where id = p_avaliacao;

  delete from public.morfologia_tarefas
   where avaliacao_id = p_avaliacao and situacao in ('na_fila', 'processando');

  /* A sessão do WhatsApp aponta para esta avaliação: deixá-la viva faria o
     agente continuar pedindo fotos de algo cancelado na tela. */
  delete from public.morfologia_sessoes where avaliacao_id = p_avaliacao;

  return json_build_object('ok', true);
end $$;

/* As avaliações deste haras, da mais recente para a mais antiga. */
create or replace function public.morfologia_app_lista(p_limite int default 50)
returns json
language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(x order by x.iniciada_em desc), '[]'::json)
    from (
      select a.id as avaliacao_id, a.estado, a.origem, a.finalidade,
             a.nota_geral, a.confianca, a.qualidade_material,
             a.iniciada_em, a.concluida_em, a.erro,
             s.nome as animal, s.animal_id,
             rel.caminho as laudo,
             (select count(*) from public.morfologia_midias m
               where m.avaliacao_id = a.id and not m.substituida
                 and m.papel <> 'EXTRA'
                 and public.morfologia_midia_serve(m.validacao)) as pecas
        from public.morfologia_avaliacoes a
        left join public.morfologia_sujeitos s on s.avaliacao_id = a.id
        left join public.morfologia_relatorios rel on rel.avaliacao_id = a.id
       where a.owner_haras_id = public.morfologia_meu_haras()
       order by a.iniciada_em desc
       limit greatest(1, least(coalesce(p_limite, 50), 200))
    ) x
$$;

/*
  O painel de uma avaliação: as nove peças do roteiro, enviadas ou não.

  As nove sempre aparecem, inclusive as que faltam — é isso que a tela precisa
  para desenhar os espaços vazios. Quem só devolve o que já chegou obriga o
  TypeScript a reconstruir o roteiro, e aí o roteiro passa a existir em dois
  lugares.
*/
create or replace function public.morfologia_app_painel(p_avaliacao uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare v_dono uuid; v_haras uuid := public.morfologia_meu_haras(); r json;
begin
  select owner_haras_id into v_dono
    from public.morfologia_avaliacoes where id = p_avaliacao;
  if v_dono is null or v_dono <> v_haras then
    raise exception 'Avaliação % não é deste haras.', p_avaliacao;
  end if;

  select json_build_object(
    'avaliacao_id', a.id,
    'estado', a.estado,
    'origem', a.origem,
    'finalidade', a.finalidade,
    'iniciada_em', a.iniciada_em,
    'concluida_em', a.concluida_em,
    'nota_geral', a.nota_geral,
    'confianca', a.confianca,
    'qualidade_material', a.qualidade_material,
    'potencial', a.potencial,
    'erro', a.erro,
    'completo', a.estado = 'PRONTA_PARA_PROCESSAR'
                or a.estado in ('PROCESSANDO', 'GERANDO_RELATORIO', 'CONCLUIDA'),

    'animal', (select json_build_object(
                 'nome', s.nome, 'animal_id', s.animal_id, 'sexo', s.sexo,
                 'idade_meses', s.idade_meses_na_avaliacao)
                 from public.morfologia_sujeitos s where s.avaliacao_id = a.id),

    'material', (
      select json_agg(json_build_object(
               'papel', p.papel,
               'rotulo', public.morfologia_rotulo(p.papel),
               'tipo', case when p.papel like 'VIDEO%' then 'video' else 'foto' end,
               'enviada', m.id is not null,
               'caminho', m.caminho,
               'validacao', m.validacao,
               'observacao', m.observacao_validacao,
               'bytes', m.bytes,
               'quadros', (select count(*) from public.morfologia_frames f
                            where f.midia_id = m.id and f.selecionado))
             order by p.i)
        from unnest(array['LATERAL_ESQ','LATERAL_DIR','FRENTE','TRASEIRA',
                          'CABECA_FRENTE','CABECA_PERFIL',
                          'VIDEO_360','VIDEO_FRENTE_TRAS','VIDEO_LATERAL'])
             with ordinality as p(papel, i)
        left join lateral (
          select m.* from public.morfologia_midias m
           where m.avaliacao_id = a.id and m.papel = p.papel and not m.substituida
           order by m.criado_em desc limit 1) m on true),

    'tarefas', coalesce((
      select json_agg(json_build_object(
               'tipo', t.tipo, 'situacao', t.situacao, 'erro', t.erro,
               'tentativas', t.tentativas) order by t.criado_em)
        from public.morfologia_tarefas t where t.avaliacao_id = a.id), '[]'::json),

    'laudo', (select json_build_object('caminho', rel.caminho, 'arquivo', rel.arquivo,
                                       'bytes', rel.bytes, 'gerado_em', rel.gerado_em)
                from public.morfologia_relatorios rel where rel.avaliacao_id = a.id)
  ) into r
  from public.morfologia_avaliacoes a
  where a.id = p_avaliacao;

  return r;
end $$;

-- ====================================================== o balde

/*
  O navegador sobe o arquivo direto para o balde, sem passar por função.

  Um vídeo de 100 MB atravessando uma Edge Function seria lento, caro e
  esbarraria no teto de corpo da requisição. O caminho começa pelo id do
  haras, e é isso que a política confere: ninguém escreve na pasta de outro.
*/
do $$
declare p text;
begin
  foreach p in array array['morfologia_app_sel', 'morfologia_app_ins',
                           'morfologia_app_upd', 'morfologia_app_del'] loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end $$;

create policy morfologia_app_sel on storage.objects for select to authenticated
  using (bucket_id = 'morfologia'
         and (storage.foldername(name))[1] = public.meu_haras_id()::text
         and public.tem_recurso('avaliacao_morfologica'));

create policy morfologia_app_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'morfologia'
              and (storage.foldername(name))[1] = public.meu_haras_id()::text
              and public.tem_recurso('avaliacao_morfologica'));

/* Reenviar a mesma peça sobrescreve o arquivo no mesmo caminho. */
create policy morfologia_app_upd on storage.objects for update to authenticated
  using (bucket_id = 'morfologia'
         and (storage.foldername(name))[1] = public.meu_haras_id()::text
         and public.tem_recurso('avaliacao_morfologica'));

create policy morfologia_app_del on storage.objects for delete to authenticated
  using (bucket_id = 'morfologia'
         and (storage.foldername(name))[1] = public.meu_haras_id()::text
         and public.tem_recurso('avaliacao_morfologica'));

-- ====================================================== acesso

do $$
declare f text;
begin
  /* Miolo e ajudantes: só o service_role e as funções acima. */
  foreach f in array array[
    'public.morfologia_gravar_midia(uuid, text, text, text, bigint, text, text[], text, int, int)',
    'public.morfologia_registrar_midia(text, text, text, text, bigint, text, text[], text, int, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  /* A porta do site. */
  foreach f in array array[
    'public.morfologia_idade_meses(date)',
    'public.morfologia_meu_haras()',
    'public.morfologia_minha_avaliacao(uuid, boolean)',
    'public.morfologia_app_abrir(uuid, text)',
    'public.morfologia_app_registrar(uuid, text, text, text, bigint, text, text[], text, int, int)',
    'public.morfologia_app_cancelar(uuid)',
    'public.morfologia_app_lista(int)',
    'public.morfologia_app_painel(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

commit;
