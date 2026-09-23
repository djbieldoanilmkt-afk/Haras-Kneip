-- 059 — O guardrail: instrução em prompt vira verificação.
--
-- O módulo inteiro se apoia numa proibição, escrita na 054: enquanto o
-- protocolo for rascunho, o laudo NÃO afirma o que o padrão da raça exige,
-- porque ninguém conferiu o documento oficial da ABCCMM. Até aqui isso era uma
-- frase no prompt do modelo de visão — um pedido. Nada conferia se foi
-- obedecido, e um parágrafo começando com "para a raça, espera-se…" saía
-- impresso debaixo do aviso que diz exatamente o contrário.
--
-- Agora cada região passa por uma pergunta de sim/não antes de virar documento,
-- e o veredito fica gravado junto da nota.
--
-- O QUE É BARRADO É A REDAÇÃO, NÃO A AVALIAÇÃO
--
-- A nota, a confiança, o peso, as evidências e a procedência continuam no
-- laudo. O animal não perde ponto porque o modelo escolheu mal as palavras — o
-- que sai é o parágrafo, e no lugar dele o laudo DIZ que reteve e por quê.
-- Texto que some sem explicação é pior que texto errado: quem lê não tem como
-- saber que faltou alguma coisa.
--
-- E O TEXTO CONTINUA NA TABELA
--
-- `morfologia_notas` guarda o que foi escrito, barrado ou não. O laudo é a
-- fronteira, não o banco: daqui a um ano alguém vai querer ver o que o
-- guardrail pegou para calibrar o limiar, e não dá para calibrar contra o que
-- foi apagado.

begin;

-- ====================================================== a marca na nota

alter table public.morfologia_notas
  add column if not exists texto_barrado boolean not null default false,
  /* A probabilidade que o Jev deu. Guardada para calibrar o corte depois. */
  add column if not exists texto_barrado_prob numeric(4,3);

comment on column public.morfologia_notas.texto_barrado is
  'A prosa desta nota afirma regra do padrão da raça e não entra no laudo.';
comment on column public.morfologia_notas.texto_barrado_prob is
  'Probabilidade medida pelo guardrail (0 a 1). Nulo quando não foi examinado.';

-- ====================================================== gravar com veredito

/*
  A assinatura antiga sai de cena em vez de ganhar irmã.

  Duas funções de mesmo nome com contagens diferentes de argumento deixam o
  PostgREST escolher — e chamada por nome, com os campos novos ausentes,
  casaria nas duas. Melhor uma função só, com os parâmetros novos no fim e com
  padrão: quem já chamava com dez continua funcionando sem tocar em nada.
*/
drop function if exists public.morfologia_registrar_nota(
  uuid, text, text, numeric, numeric, text[], text[], text, jsonb, uuid[]);

create function public.morfologia_registrar_nota(
  p_avaliacao uuid,
  p_criterio text,
  p_etapa text,
  p_nota numeric,
  p_confianca numeric default null,
  p_pontos_fortes text[] default '{}',
  p_pontos_atencao text[] default '{}',
  p_analise text default null,
  p_evidencias jsonb default '[]'::jsonb,
  p_conhecimento_ids uuid[] default '{}',
  p_texto_barrado boolean default false,
  p_texto_barrado_prob numeric default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid;
  v_prot uuid;
  v_peso numeric;
  v_id uuid;
begin
  select owner_haras_id, protocolo_id into v_haras, v_prot
    from public.morfologia_avaliacoes where id = p_avaliacao;
  if v_haras is null then
    raise exception 'Avaliação % não existe.', p_avaliacao;
  end if;

  if p_etapa not in ('primaria', 'revisao') then
    raise exception 'Etapa % não é de leitura. A etapa final é escrita pela reconciliação.', p_etapa;
  end if;

  if p_nota is null or p_nota < 0 or p_nota > 10 then
    raise exception 'Nota % está fora da escala de 0 a 10.', p_nota;
  end if;
  if p_confianca is not null and (p_confianca < 0 or p_confianca > 10) then
    raise exception 'Confiança % está fora da escala de 0 a 10.', p_confianca;
  end if;
  if p_texto_barrado_prob is not null
     and (p_texto_barrado_prob < 0 or p_texto_barrado_prob > 1) then
    raise exception 'A probabilidade do guardrail (%) não está entre 0 e 1.', p_texto_barrado_prob;
  end if;

  v_peso := public.morfologia_peso(v_prot, p_criterio);
  if v_peso is null then
    raise exception 'O critério "%" não existe no protocolo desta avaliação.', p_criterio;
  end if;

  insert into public.morfologia_notas
    (owner_haras_id, avaliacao_id, criterio, etapa, nota, confianca, peso,
     nota_ponderada, pontos_fortes, pontos_atencao, analise, evidencias,
     conhecimento_ids, texto_barrado, texto_barrado_prob)
  values
    (v_haras, p_avaliacao, p_criterio, p_etapa, p_nota, p_confianca, v_peso,
     p_nota * v_peso, coalesce(p_pontos_fortes, '{}'), coalesce(p_pontos_atencao, '{}'),
     p_analise, coalesce(p_evidencias, '[]'::jsonb), coalesce(p_conhecimento_ids, '{}'),
     coalesce(p_texto_barrado, false), p_texto_barrado_prob)
  on conflict (avaliacao_id, criterio, etapa) do update
     set nota = excluded.nota,
         confianca = excluded.confianca,
         peso = excluded.peso,
         nota_ponderada = excluded.nota_ponderada,
         pontos_fortes = excluded.pontos_fortes,
         pontos_atencao = excluded.pontos_atencao,
         analise = excluded.analise,
         evidencias = excluded.evidencias,
         conhecimento_ids = excluded.conhecimento_ids,
         texto_barrado = excluded.texto_barrado,
         texto_barrado_prob = excluded.texto_barrado_prob
  returning id into v_id;

  return v_id;
end $$;

-- ====================================================== o veredito acompanha o texto

/*
  Reconciliar é a única parte do sistema que COPIA texto de uma nota para
  outra: a final leva a prosa da leitura que prevaleceu.

  Se o veredito não viesse junto, o texto barrado voltaria pela porta dos
  fundos — a primária limpa passaria a marca para uma final que carrega a
  redação da revisão. Por isso a marca usa exatamente a mesma condição de
  ramo que o texto, e não uma sua.
*/
create or replace function public.morfologia_reconciliar(p_aval uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_haras uuid; v_prot uuid;
  v_idade int; v_adulto int;
  v_com_projecao text[];
  v_geral numeric; v_conf numeric;
  v_proj numeric; v_conf_proj numeric;
  v_potencial text; v_rotulos text;
  v_tol numeric := public.morfologia_tolerancia();
  v_divergentes int;
begin
  select a.owner_haras_id, a.protocolo_id into v_haras, v_prot
    from public.morfologia_avaliacoes a where a.id = p_aval;
  if v_haras is null then
    raise exception 'Avaliação % não existe.', p_aval;
  end if;

  select s.idade_meses_na_avaliacao into v_idade
    from public.morfologia_sujeitos s where s.avaliacao_id = p_aval;

  select coalesce((p.regras_jovens ->> 'idade_adulta_meses')::int, 48),
         coalesce(array(select jsonb_array_elements_text(p.regras_jovens -> 'criterios_com_projecao')), '{}')
    into v_adulto, v_com_projecao
    from public.morfologia_protocolos p where p.id = v_prot;

  delete from public.morfologia_notas where avaliacao_id = p_aval and etapa = 'final';

  insert into public.morfologia_notas
    (owner_haras_id, avaliacao_id, criterio, etapa, nota, confianca, peso,
     nota_ponderada, situacao, pontos_fortes, pontos_atencao, analise,
     evidencias, conhecimento_ids, texto_barrado, texto_barrado_prob)
  select
    v_haras, p_aval, x.criterio, 'final', x.nota, x.confianca, x.peso,
    x.nota * x.peso, x.situacao,
    x.pontos_fortes, x.pontos_atencao, x.analise, x.evidencias, x.conhecimento_ids,
    x.texto_barrado, x.texto_barrado_prob
  from (
    select
      pr.criterio,
      pr.peso,
      case
        when rv.nota is null then pr.nota
        when abs(pr.nota - rv.nota) <= v_tol then round((pr.nota + rv.nota) / 2, 1)
        when coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0) then rv.nota
        when coalesce(pr.confianca, 0) > coalesce(rv.confianca, 0) then pr.nota
        /* Empatadas e longe uma da outra: fica a menor. */
        else least(pr.nota, rv.nota)
      end as nota,
      case
        when rv.nota is null then pr.confianca
        when abs(pr.nota - rv.nota) <= v_tol then round((coalesce(pr.confianca, 0) + coalesce(rv.confianca, 0)) / 2, 1)
        /* Discordaram: a certeza é a da leitura mais fraca, não a média. */
        else least(coalesce(pr.confianca, 0), coalesce(rv.confianca, 0))
      end as confianca,
      case
        when rv.nota is null then 'sem_revisao'
        when abs(pr.nota - rv.nota) <= v_tol then 'convergente'
        else 'divergente'
      end as situacao,
      /* O texto fica com a leitura que prevaleceu na nota. */
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.pontos_fortes else pr.pontos_fortes end as pontos_fortes,
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.pontos_atencao else pr.pontos_atencao end as pontos_atencao,
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.analise else pr.analise end as analise,
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.evidencias else pr.evidencias end as evidencias,
      /* O veredito é do texto: segue o mesmo ramo, nunca um seu. */
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.texto_barrado else pr.texto_barrado end as texto_barrado,
      case when rv.nota is not null and coalesce(rv.confianca, 0) > coalesce(pr.confianca, 0)
           then rv.texto_barrado_prob else pr.texto_barrado_prob end as texto_barrado_prob,
      /* A procedência soma: o laudo precisa citar tudo que foi consultado. */
      (select coalesce(array_agg(distinct i), '{}')
         from unnest(pr.conhecimento_ids || coalesce(rv.conhecimento_ids, '{}')) i)
        as conhecimento_ids
    from public.morfologia_notas pr
    left join public.morfologia_notas rv
      on rv.avaliacao_id = pr.avaliacao_id
     and rv.criterio = pr.criterio
     and rv.etapa = 'revisao'
    where pr.avaliacao_id = p_aval and pr.etapa = 'primaria'
  ) x;

  select round(sum(nota * peso) / nullif(sum(peso), 0), 1),
         round(sum(coalesce(confianca, 0) * peso) / nullif(sum(peso), 0), 1),
         count(*) filter (where situacao = 'divergente')
    into v_geral, v_conf, v_divergentes
    from public.morfologia_notas
   where avaliacao_id = p_aval and etapa = 'final';

  /*
    ANIMAL EM CRESCIMENTO

    O próprio protocolo lista quais regiões ainda mudam com a idade. A conta
    aqui é a nota SÓ do que já está estabilizado — não é previsão do que o
    animal vai ser. Prever exigiria saber como um Mangalarga se desenvolve,
    que é regra racial, e o protocolo ainda está em rascunho.

    O texto em `potencial` diz isso com todas as letras, para ninguém ler o
    número como promessa.
  */
  if v_idade is not null and v_idade < v_adulto and cardinality(v_com_projecao) > 0 then
    select round(sum(nota * peso) / nullif(sum(peso), 0), 1),
           round(sum(coalesce(confianca, 0) * peso) / nullif(sum(peso), 0), 1)
      into v_proj, v_conf_proj
      from public.morfologia_notas
     where avaliacao_id = p_aval and etapa = 'final'
       and criterio <> all (v_com_projecao);

    select string_agg(c ->> 'titulo', ', ' order by c ->> 'titulo')
      into v_rotulos
      from public.morfologia_protocolos p,
           jsonb_array_elements(p.criterios) c
     where p.id = v_prot and c ->> 'chave' = any (v_com_projecao);

    v_potencial := format(
      'Aos %s meses, o animal ainda está crescendo. A nota %s é a das regiões que já '
      || 'estão estabilizadas nesta idade. Ficam de fora desta conta as que mudam com o '
      || 'crescimento: %s. Isto NÃO é uma previsão da nota adulta.',
      v_idade, to_char(v_proj, 'FM9D0'), coalesce(v_rotulos, 'nenhuma'));
  end if;

  update public.morfologia_avaliacoes
     set nota_geral = v_geral,
         confianca = v_conf,
         qualidade_material = public.morfologia_qualidade_material(p_aval),
         nota_projetada = v_proj,
         confianca_projecao = v_conf_proj,
         potencial = v_potencial,
         atualizado_em = now()
   where id = p_aval;

  return json_build_object(
    'ok', true,
    'nota_geral', v_geral,
    'confianca', v_conf,
    'divergentes', v_divergentes,
    'texto_retido', (select count(*) from public.morfologia_notas
                      where avaliacao_id = p_aval and etapa = 'final' and texto_barrado),
    'qualidade_material', public.morfologia_qualidade_material(p_aval),
    'nota_projetada', v_proj,
    'potencial', v_potencial);
end $$;

-- ====================================================== a fronteira

/*
  O que o laudo diz no lugar do parágrafo retido.

  Função em vez de literal porque o PDF e a tela vão mostrar a mesma frase, e
  frase repetida em dois lugares vira duas frases diferentes na primeira vez
  que alguém ajustar uma delas.
*/
create or replace function public.morfologia_texto_retido()
returns text language sql immutable as $$
  select 'A análise escrita desta região foi retida: afirmava exigência do '
      || 'padrão oficial da raça, que este laudo não aplica enquanto o '
      || 'protocolo estiver em rascunho. A nota, o peso e as evidências abaixo '
      || 'não foram alterados.'
$$;

/*
  O laudo, com a única mudança sendo o que ele deixa de imprimir.

  Barrar aqui, e não na hora de gravar a nota, é de propósito: o laudo é o
  documento que sai daqui para a mão de terceiro, e é o único lugar onde a
  proibição precisa valer. A tabela continua com tudo.
*/
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

    /* Quantas regiões tiveram a prosa retida, para quem lê o documento inteiro
       saber que houve corte sem ter de caçar região por região. */
    'texto_retido_em', (
      select count(*) from public.morfologia_notas nt
       where nt.avaliacao_id = a.id and nt.etapa = 'final' and nt.texto_barrado),

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
               /* A prosa inteira sai junto: uma afirmação de regra racial
                  escondida num marcador vale tanto quanto no parágrafo. */
               'pontos_fortes',
                 case when nt.texto_barrado then '{}'::text[] else nt.pontos_fortes end,
               'pontos_atencao',
                 case when nt.texto_barrado then '{}'::text[] else nt.pontos_atencao end,
               'analise', case when nt.texto_barrado then null else nt.analise end,
               /* Sumir em silêncio seria pior: quem lê não saberia que faltou. */
               'texto_retido',
                 case when nt.texto_barrado then public.morfologia_texto_retido() end,
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

-- ====================================================== acesso

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_registrar_nota(uuid, text, text, numeric, numeric, text[], text[], text, jsonb, uuid[], boolean, numeric)',
    'public.morfologia_reconciliar(uuid)',
    'public.morfologia_texto_retido()',
    'public.morfologia_laudo(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
