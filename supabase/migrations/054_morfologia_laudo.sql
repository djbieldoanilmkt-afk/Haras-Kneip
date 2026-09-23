-- 054 — O laudo, montado pelo banco.
--
-- O documento que sai daqui leva a marca do haras e vai parar na mão de quem
-- está decidindo comprar um cavalo. Então ele não se monta com o que estiver
-- solto na tabela: ou a avaliação tem notas finais, ou não há laudo.
--
-- O AVISO NÃO É RODAPÉ
--
-- Enquanto o protocolo for rascunho, este laudo NÃO aplica o padrão oficial da
-- ABCCMM — ele aplica metodologia de observação. Quem lê precisa saber disso
-- sem ter de perguntar, e o texto vai no JSON como campo de primeira classe,
-- não como uma linha escondida no fim.
--
-- A PROCEDÊNCIA É A QUE FOI USADA
--
-- Cada nota guarda os ids do conhecimento que valeu para ela. O laudo junta só
-- esses — não a base inteira. É o que permite responder "com base em quê você
-- disse isso?" dois anos depois, e é por isso que a lista sai deduplicada e em
-- ordem de autoridade, não em ordem de cadastro.

begin;

create or replace function public.morfologia_laudo(p_aval uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_prot uuid;
  v_criterios text[];
  n int;
  r json;
begin
  select a.protocolo_id into v_prot
    from public.morfologia_avaliacoes a where a.id = p_aval;
  if v_prot is null then
    raise exception 'Avaliação % não existe.', p_aval;
  end if;

  select count(*) into n from public.morfologia_notas
   where avaliacao_id = p_aval and etapa = 'final';
  if n = 0 then
    raise exception 'A avaliação % não tem nota final: não há laudo para montar.', p_aval;
  end if;

  /* A ordem do protocolo é a ordem de leitura de um cavalo. Alfabética faria o
     laudo começar em "aparência geral" e terminar em "tronco". */
  select array(select c ->> 'chave'
                 from public.morfologia_protocolos p,
                      jsonb_array_elements(p.criterios)
                        with ordinality as t(c, i)
                where p.id = v_prot order by t.i)
    into v_criterios;

  select json_build_object(
    'avaliacao_id', a.id,
    'gerado_em', now(),
    'haras', (select h.nome from public.haras h where h.id = a.owner_haras_id),

    'animal', (
      select json_build_object(
        'nome', s.nome, 'sexo', s.sexo, 'raca', s.raca,
        'idade_meses', s.idade_meses_na_avaliacao,
        'tipo', s.tipo, 'proprietario', s.proprietario)
        from public.morfologia_sujeitos s where s.avaliacao_id = a.id),

    'nota_geral', a.nota_geral,
    'confianca', a.confianca,
    'qualidade_material', a.qualidade_material,
    'nota_projetada', a.nota_projetada,
    'potencial', a.potencial,
    'finalidade', a.finalidade,

    'protocolo', (
      select json_build_object('versao', p.versao, 'situacao', p.situacao,
                               'fonte', p.fonte_nome)
        from public.morfologia_protocolos p where p.id = v_prot),

    /* Para quem LÊ o laudo — não é o mesmo texto que vai ao modelo. */
    'aviso', (
      select case when p.situacao <> 'vigente' then
        'Este laudo NÃO aplica o padrão oficial da raça: o protocolo usado está em '
        || 'RASCUNHO (versão ' || p.versao || '). O que está avaliado aqui é a '
        || 'conformação visível nas imagens, segundo metodologia de observação — '
        || 'não o julgamento oficial da ABCCMM, e não substitui inspeção presencial.'
      end
        from public.morfologia_protocolos p where p.id = v_prot),

    'regioes', coalesce((
      select json_agg(json_build_object(
               'chave', nt.criterio,
               'titulo', (select c ->> 'titulo'
                            from public.morfologia_protocolos p,
                                 jsonb_array_elements(p.criterios) c
                           where p.id = v_prot and c ->> 'chave' = nt.criterio),
               'nota', nt.nota,
               'confianca', nt.confianca,
               'peso', nt.peso,
               'situacao', nt.situacao,
               'pontos_fortes', nt.pontos_fortes,
               'pontos_atencao', nt.pontos_atencao,
               'analise', nt.analise,
               'evidencias', nt.evidencias)
             order by array_position(v_criterios, nt.criterio))
        from public.morfologia_notas nt
       where nt.avaliacao_id = a.id and nt.etapa = 'final'), '[]'::json),

    'procedencia', coalesce((
      select json_agg(json_build_object(
               'conhecimento_id', k.id,
               'categoria', k.categoria,
               'tipo_fonte', k.tipo_fonte,
               'afirmacao', k.afirmacao,
               'fonte', f.titulo,
               'autor', f.autor)
             order by public.morfologia_autoridade(k.tipo_fonte), k.afirmacao)
        from public.morfologia_conhecimento k
        left join public.morfologia_fontes f on f.id = k.fonte_id
       where k.id in (
         select distinct unnest(nt.conhecimento_ids)
           from public.morfologia_notas nt
          where nt.avaliacao_id = a.id and nt.etapa = 'final')), '[]'::json),

    'material', coalesce((
      select json_agg(json_build_object(
               'papel', m.papel, 'rotulo', public.morfologia_rotulo(m.papel),
               'caminho', m.caminho, 'validacao', m.validacao,
               'quadros', (select count(*) from public.morfologia_frames fr
                            where fr.midia_id = m.id and fr.selecionado))
             order by m.papel)
        from public.morfologia_midias m
       where m.avaliacao_id = a.id
         and public.morfologia_midia_serve(m.validacao) and not m.substituida), '[]'::json),

    'arquivo', (
      select json_build_object('caminho', rel.caminho, 'arquivo', rel.arquivo,
                               'bytes', rel.bytes, 'gerado_em', rel.gerado_em)
        from public.morfologia_relatorios rel where rel.avaliacao_id = a.id)
  ) into r
  from public.morfologia_avaliacoes a
  where a.id = p_aval;

  return r;
end $$;

-- ====================================================== registro do arquivo

/*
  Um laudo por avaliação.

  Refazer — porque a nota foi corrigida, ou porque o layout mudou — substitui.
  Empilhar versões faria a tela e o WhatsApp terem de escolher qual mandar, e a
  escolha errada é mandar o laudo velho para o comprador.
*/
create unique index if not exists morfologia_relatorios_um_por_avaliacao
  on public.morfologia_relatorios (avaliacao_id);

create or replace function public.morfologia_registrar_relatorio(
  p_avaliacao uuid, p_caminho text, p_arquivo text, p_bytes bigint default null
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

  insert into public.morfologia_relatorios
    (owner_haras_id, avaliacao_id, caminho, arquivo, bytes)
  values (v_haras, p_avaliacao, p_caminho, p_arquivo, p_bytes)
  on conflict (avaliacao_id) do update
     set caminho = excluded.caminho,
         arquivo = excluded.arquivo,
         bytes = excluded.bytes,
         gerado_em = now()
  returning id into v_id;

  return v_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_laudo(uuid)',
    'public.morfologia_registrar_relatorio(uuid, text, text, bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
