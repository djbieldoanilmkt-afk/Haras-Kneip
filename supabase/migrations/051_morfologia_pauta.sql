-- 051 — O que vai em cada chamada de IA, e como a fila anda sozinha.
--
-- POR QUE NÃO UMA CHAMADA POR REGIÃO
--
-- Doze regiões vezes duas leituras dariam 24 chamadas de visão por avaliação,
-- cada uma reenviando as mesmas fotos. Além de caro e lento, é artificial:
-- ninguém olha a foto de perfil doze vezes. Um jurado olha o animal de lado e
-- lê pescoço, tronco, dorso e garupa de uma vez — as regiões que aquela vista
-- mostra. Os grupos abaixo são isso.
--
-- Três grupos, duas passadas: seis chamadas por avaliação.
--
-- A COBERTURA É CONFERIDA, NÃO PROMETIDA
--
-- Se uma região ficar fora de todos os grupos, ela nunca recebe nota e a nota
-- geral sai de onze regiões fingindo ser doze — em silêncio. Se aparecer em
-- dois grupos, a segunda leitura apaga a primeira. A prova que acompanha esta
-- migração confere isso contra o protocolo.

begin;

-- ====================================================== grupos

create or replace function public.morfologia_grupos_de_analise()
returns table (grupo text, titulo text, criterios text[], papeis text[])
language sql immutable
as $$
  select * from (values
    ('CONJUNTO', 'O animal de lado',
     array['aparencia_geral', 'caracterizacao_racial', 'pescoco', 'tronco',
           'dorso_lombo', 'garupa_ancas', 'equilibrio_geral'],
     array['LATERAL_ESQ', 'LATERAL_DIR', 'VIDEO_360']),

    ('CABECA', 'A cabeça',
     array['cabeca_expressao'],
     array['CABECA_FRENTE', 'CABECA_PERFIL']),

    /* Aprumo é a única coisa que não se lê parado: o vídeo indo e voltando
       mostra o que a foto de frente esconde. */
    ('MEMBROS', 'Frente, traseira e os membros em movimento',
     array['conjunto_frente', 'membros_anteriores', 'membros_posteriores', 'aprumos'],
     array['FRENTE', 'TRASEIRA', 'VIDEO_FRENTE_TRAS', 'VIDEO_LATERAL'])
  ) as g(grupo, titulo, criterios, papeis)
$$;

-- ====================================================== critério -> categoria
--
-- Duas listas diferentes, de propósito.
--
-- O PROTOCOLO tem os critérios que viram nota ("garupa_ancas"). A BASE DE
-- CONHECIMENTO tem categorias de assunto ("GARUPA", "ANGULACOES"), porque uma
-- frase de um jurado sobre angulação serve para mais de uma região. Esta
-- função é a ponte: sem ela, buscar conhecimento pelo nome do critério não
-- acharia nada e o modelo trabalharia sem fonte nenhuma.

create or replace function public.morfologia_categorias_do_criterio(p_criterio text)
returns text[]
language sql immutable
as $$
  select case p_criterio
    when 'aparencia_geral'      then array['APARENCIA_GERAL', 'CONFORMACAO_FUNCIONAL']
    when 'caracterizacao_racial' then array['EXPRESSAO_RACIAL']
    when 'cabeca_expressao'     then array['CABECA']
    when 'pescoco'              then array['PESCOCO']
    when 'conjunto_frente'      then array['CONJUNTO_FRENTE', 'ANGULACOES']
    when 'tronco'               then array['TRONCO']
    when 'dorso_lombo'          then array['LINHA_SUPERIOR']
    when 'garupa_ancas'         then array['GARUPA']
    when 'membros_anteriores'   then array['MEMBROS_ANTERIORES', 'APRUMOS']
    when 'membros_posteriores'  then array['MEMBROS_POSTERIORES', 'APRUMOS']
    when 'aprumos'              then array['APRUMOS', 'MOVIMENTO', 'MARCHA']
    when 'equilibrio_geral'     then array['PROPORCOES']
    else array[]::text[]
  end
$$;

-- ====================================================== pauta

/*
  Tudo que uma chamada de análise precisa, num JSON só.

  Montar isto no TypeScript exigiria cinco consultas e repetir, em outra
  linguagem, a ordem da autoridade das fontes — que é a regra central do
  protocolo. Aqui ela é uma cláusula `order by` num lugar só.

  O que NÃO vai aqui: URL assinada. O caminho no balde vai cru, e quem assina é
  quem chama, na hora, com validade curta.
*/
create or replace function public.morfologia_pauta(p_aval uuid, p_grupo text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_prot uuid;
  v_criterios text[];
  v_papeis text[];
  v_titulo text;
  v_idade int;
  v_adulto int;
  v_jovem boolean;
  r json;
begin
  select g.criterios, g.papeis, g.titulo into v_criterios, v_papeis, v_titulo
    from public.morfologia_grupos_de_analise() g where g.grupo = p_grupo;
  if v_criterios is null then
    raise exception 'O grupo de análise "%" não existe.', p_grupo;
  end if;

  select a.protocolo_id into v_prot
    from public.morfologia_avaliacoes a where a.id = p_aval;
  if v_prot is null then
    raise exception 'Avaliação % não existe ou está sem protocolo.', p_aval;
  end if;

  select s.idade_meses_na_avaliacao into v_idade
    from public.morfologia_sujeitos s where s.avaliacao_id = p_aval;
  select coalesce((p.regras_jovens ->> 'idade_adulta_meses')::int, 48)
    into v_adulto from public.morfologia_protocolos p where p.id = v_prot;
  v_jovem := v_idade is not null and v_idade < v_adulto;

  select json_build_object(
    'grupo', p_grupo,
    'titulo', v_titulo,

    'protocolo', (
      select json_build_object(
        'versao', p.versao,
        'situacao', p.situacao,
        /*
          O aviso que o modelo precisa ler antes de tudo.

          Enquanto o protocolo é rascunho, ele NÃO contém as regras raciais da
          ABCCMM — só metodologia. Sem dizer isso, o modelo preencheria o vazio
          com o que "sabe" sobre cavalos, e o laudo sairia afirmando padrão de
          raça que ninguém conferiu.
        */
        'aviso', case when p.situacao <> 'vigente' then
          'Este protocolo está em RASCUNHO: ele NÃO contém o padrão oficial da raça. '
          || 'Avalie apenas o que as imagens mostram e o que as regras abaixo dizem. '
          || 'NUNCA afirme regra racial ("o padrão da raça exige...") — nenhuma foi conferida.'
        end)
        from public.morfologia_protocolos p where p.id = v_prot),

    'animal', (
      select json_build_object(
        'nome', s.nome, 'sexo', s.sexo, 'idade_meses', s.idade_meses_na_avaliacao,
        'jovem', v_jovem,
        'aviso_jovem', case when v_jovem then
          (select p.regras_jovens ->> 'aviso' from public.morfologia_protocolos p
            where p.id = v_prot) end)
        from public.morfologia_sujeitos s where s.avaliacao_id = p_aval),

    'criterios', coalesce((
      select json_agg(json_build_object(
               'chave', c ->> 'chave',
               'titulo', c ->> 'titulo',
               'descricao', c ->> 'descricao')
             order by array_position(v_criterios, c ->> 'chave'))
        from public.morfologia_protocolos p,
             jsonb_array_elements(p.criterios) c
       where p.id = v_prot and c ->> 'chave' = any (v_criterios)), '[]'::json),

    /* Na ordem da autoridade. Padrão oficial antes de fala de jurado, sempre. */
    'conhecimento', coalesce((
      select json_agg(x order by x.autoridade, x.afirmacao)
        from (
          select distinct k.autoridade, k.tipo_fonte, k.afirmacao, k.fonte,
                 k.autor, k.conhecimento_id
            from unnest(v_criterios) crit,
                 unnest(public.morfologia_categorias_do_criterio(crit)) cat,
                 public.morfologia_conhecimento_do_criterio(v_prot, cat) k
        ) x), '[]'::json),

    'imagens', coalesce((
      select json_agg(y order by y.ordem, y.segundo)
        from (
          select m.papel, public.morfologia_rotulo(m.papel) as rotulo,
                 m.caminho, null::numeric as segundo,
                 array_position(v_papeis, m.papel) as ordem
            from public.morfologia_midias m
           where m.avaliacao_id = p_aval
             and m.papel = any (v_papeis)
             and m.tipo = 'foto'
             and public.morfologia_midia_serve(m.validacao)
             and not m.substituida

          union all

          /* Do vídeo só entram os quadros escolhidos: mandar o arquivo inteiro
             não é possível, e mandar quadro descartado gasta imagem ruim. */
          select m.papel, public.morfologia_rotulo(m.papel) as rotulo,
                 f.caminho, f.segundo,
                 array_position(v_papeis, m.papel) as ordem
            from public.morfologia_frames f
            join public.morfologia_midias m on m.id = f.midia_id
           where f.avaliacao_id = p_aval
             and m.papel = any (v_papeis)
             and f.selecionado
             and public.morfologia_midia_serve(m.validacao)
             and not m.substituida
        ) y), '[]'::json)
  ) into r;

  return r;
end $$;

-- ====================================================== a fila anda sozinha

/*
  Qual etapa vem depois de qual.

  A sequência mora aqui, em SQL, e não espalhada entre o trabalhador de vídeo e
  a função de análise. Quem termina uma etapa não precisa saber o que vem
  depois — e trocar a ordem é mexer nesta função, não em três serviços.
*/
create or replace function public.morfologia_proxima_etapa(p_tipo text)
returns text
language sql immutable
as $$
  select case p_tipo
    when 'PROCESSAR_MIDIA'  then 'ANALISE_PRIMARIA'
    when 'ANALISE_PRIMARIA' then 'ANALISE_REVISAO'
    when 'ANALISE_REVISAO'  then 'GERAR_RELATORIO'
    when 'GERAR_RELATORIO'  then 'ENVIAR_WHATSAPP'
  end
$$;

/*
  Fecha a tarefa e chama a próxima. Falha NÃO chama ninguém.

  Reconciliar acontece ao fechar a revisão, e não como tarefa própria: não tem
  IA, não pode falhar por rede e não faz sentido existir sem as duas leituras.
  Uma tarefa a menos é um ponto de parada a menos.

  O tipo RECONCILIAR continua na tabela para quem quiser refazer a conta à mão
  depois de corrigir uma nota.
*/
create or replace function public.morfologia_tarefa_concluir(
  p_id uuid, p_ok boolean, p_erro text default null
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_aval uuid;
  v_tipo text;
  v_proxima text;
begin
  update public.morfologia_tarefas
     set situacao = case when p_ok then 'concluida' else 'falhou' end,
         erro = case when p_ok then null else left(coalesce(p_erro, 'erro sem descrição'), 2000) end,
         concluido_em = now()
   where id = p_id
  returning avaliacao_id, tipo into v_aval, v_tipo;

  if v_aval is null then return false; end if;
  if not p_ok then return true; end if;

  if v_tipo = 'ANALISE_REVISAO' then
    perform public.morfologia_reconciliar(v_aval);
  end if;

  v_proxima := public.morfologia_proxima_etapa(v_tipo);
  if v_proxima is not null then
    perform public.morfologia_enfileirar(v_aval, v_proxima);

    update public.morfologia_avaliacoes
       set estado = case v_proxima
             when 'ANALISE_PRIMARIA' then 'PROCESSANDO'
             when 'GERAR_RELATORIO'  then 'GERANDO_RELATORIO'
             else estado end,
           atualizado_em = now()
     where id = v_aval;
  end if;

  return true;
end $$;

-- ====================================================== acesso

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_pauta(uuid, text)',
    'public.morfologia_tarefa_concluir(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
