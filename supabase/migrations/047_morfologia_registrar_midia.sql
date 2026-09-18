-- 047 — A mídia que chega pelo WhatsApp entra na avaliação.
--
-- UM BURACO QUE SÓ APARECEU AGORA
--
-- A 042 trata como entregue apenas o que está 'ACEITA'. Enquanto a validação
-- não existia, todo mundo entrava como ACEITA e ninguém notou. Agora que a
-- conferência de arquivo distingue "serve" de "serve, mas podia ser melhor",
-- uma foto marcada REPETIR_RECOMENDADO deixaria o agente pedindo a MESMA foto
-- para sempre: ela está gravada, mas o roteiro não a conta.
--
-- A correção é uma função só, usada nos três lugares que perguntam a mesma
-- coisa — roteiro, situação e fila do trabalhador. Repetir a condição em três
-- consultas é como o buraco nasceu.
--
-- O QUE NÃO SE GRAVA
--
-- Mídia recusada não vira linha. O webhook confere ANTES de subir o arquivo —
-- é o que evita mandar 120 MB ao balde para ele devolver erro. Sem arquivo, a
-- linha apontaria para o nada, e `caminho` é obrigatório por bom motivo. O
-- registro do que foi recusado é a conversa: o dono recebe o porquê e manda
-- outra.

begin;

-- ====================================================== o que conta como entregue

/*
  "Serve para avaliar."

  REPETIR_RECOMENDADO é foto que dá para usar — pequena, mas legível. Ela
  conta como entregue e vai para a análise; o que ela muda é o recado ao dono
  e a nota de qualidade do material no laudo.
*/
create or replace function public.morfologia_midia_serve(p_validacao text)
returns boolean
language sql immutable
as $$
  select p_validacao in ('ACEITA', 'REPETIR_RECOMENDADO')
$$;

-- ---------------------------------------------------- roteiro (corrige 042)

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
           and public.morfologia_midia_serve(m.validacao)
           and not m.substituida)
      limit 1),
    'PRONTA_PARA_PROCESSAR')
$$;

-- --------------------------------------------------- situação (corrige 042)

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
    /* O papel que o estado atual está pedindo. O webhook precisa dele antes
       de conferir o arquivo: a regra depende de ser foto ou vídeo. */
    'papel', public.morfologia_papel_do_estado(a.estado),
    'animal', su.nome,
    'animal_id', su.animal_id,
    'tipo_sujeito', su.tipo,
    'sujeito', to_jsonb(su.*) - 'instantaneo',
    'aceitas', coalesce((
      select json_agg(m.papel order by m.criado_em)
        from public.morfologia_midias m
       where m.avaliacao_id = a.id
         and public.morfologia_midia_serve(m.validacao) and not m.substituida
    ), '[]'::json),
    'faltando', coalesce((
      select json_agg(public.morfologia_rotulo(public.morfologia_papel_do_estado(e)))
        from unnest(public.morfologia_ordem()) e
       where not exists (
         select 1 from public.morfologia_midias m
          where m.avaliacao_id = a.id
            and m.papel = public.morfologia_papel_do_estado(e)
            and public.morfologia_midia_serve(m.validacao) and not m.substituida)
    ), '[]'::json),
    'instrucao', public.morfologia_instrucao(a.estado)
  ) end
  from public.morfologia_sessoes s
  join public.morfologia_avaliacoes a on a.id = s.avaliacao_id
  left join public.morfologia_sujeitos su on su.avaliacao_id = a.id
  where s.telefone = p_telefone
    and a.estado not in ('CONCLUIDA', 'CANCELADA', 'FALHOU')
$$;

-- ----------------------------------------- fila do trabalhador (corrige 045)

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
         and public.morfologia_midia_serve(m.validacao)
         and not m.substituida
    ), '[]'::json)
  ) into v;

  return coalesce(v, json_build_object('tarefa_id', null));
end $$;

-- ====================================================== gravar a mídia

/*
  Grava a mídia recebida e devolve o próximo passo do roteiro.

  Uma chamada só faz as quatro coisas que precisam acontecer juntas: aposenta
  a versão anterior, grava a nova, move o roteiro e — quando fecha o material
  — enfileira o processamento. Separado em quatro chamadas, um reenvio no meio
  deixaria a avaliação num estado que não existe no papel.
*/
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
declare
  v_haras uuid;
  v_aval uuid;
  v_id uuid;
  v_substituiu boolean := false;
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

  /*
    Só o que serve aposenta o que já estava lá.

    O dono tem uma lateral boa gravada e manda, por engano, um vídeo naquele
    passo. Se a recusa aposentasse a anterior, ele perderia a foto boa por
    causa do próprio engano — e o roteiro voltaria a pedir o que já tinha.
  */
  if public.morfologia_midia_serve(p_validacao) then
    update public.morfologia_midias
       set substituida = true
     where avaliacao_id = v_aval
       and papel = p_papel
       and not substituida;
    v_substituiu := found;
  end if;

  insert into public.morfologia_midias
    (owner_haras_id, avaliacao_id, papel, tipo, caminho, mime, bytes,
     largura, altura, validacao, codigos_problema, observacao_validacao)
  values
    (v_haras, v_aval, p_papel,
     case when p_papel like 'VIDEO%' then 'video' else 'foto' end,
     p_caminho, p_mime, p_bytes, p_largura, p_altura,
     p_validacao, coalesce(p_codigos, '{}'), p_observacao)
  returning id into v_id;

  update public.morfologia_sessoes set atualizado_em = now() where telefone = p_telefone;

  r := public.morfologia_avancar(v_aval);

  /*
    Material fechado enfileira sozinho.

    Deixar isso para o webhook significaria que uma queda entre "gravei a
    última foto" e "pedi o processamento" deixaria a avaliação pronta e
    parada, esperando alguém perceber. Aqui está na mesma transação da última
    mídia: ou as duas coisas aconteceram, ou nenhuma.
  */
  if (r->>'completo')::boolean then
    perform public.morfologia_enfileirar(v_aval, 'PROCESSAR_MIDIA');
  end if;

  return json_build_object(
    'ok', true,
    'midia_id', v_id,
    'papel', p_papel,
    /* O nome da peça em português, para o agente confirmar o recebimento sem
       repetir a tradução de PAPEL para "foto do lado esquerdo" em TypeScript. */
    'rotulo', public.morfologia_rotulo(p_papel),
    'validacao', p_validacao,
    'substituiu', v_substituiu,
    'estado', r->>'estado',
    'instrucao', r->>'instrucao',
    'completo', (r->>'completo')::boolean);
end $$;

revoke all on function
  public.morfologia_registrar_midia(text, text, text, text, bigint, text, text[], text, int, int)
  from public, anon, authenticated;
grant execute on function
  public.morfologia_registrar_midia(text, text, text, text, bigint, text, text[], text, int, int)
  to service_role;

commit;
