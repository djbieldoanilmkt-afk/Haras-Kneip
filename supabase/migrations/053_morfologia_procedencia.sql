-- 053 — Procedência por região, e os dois buracos que a primeira análise real
-- mostrou.
--
-- A primeira avaliação com fotos de verdade passou, mas revelou duas coisas:
--
-- 1. A CABEÇA era a única região julgada sem NENHUMA regra de metodologia. As
--    outras quinze categorias tinham; essa ficou de fora da 044 e ninguém
--    notou, porque nada quebra — o modelo simplesmente julga sozinho.
--
-- 2. Toda nota de um grupo recebia a procedência do GRUPO INTEIRO. A nota de
--    aparência geral saía citando onze itens, entre eles regras sobre aprumo.
--    Quando alguém perguntar "com base em quê você disse isso?", a resposta
--    tem de ser o que valeu para AQUELA região.
--
-- E uma terceira, de projeto: a regra de animal em crescimento estava
-- cadastrada e nunca chegava ao modelo, porque nenhum critério aponta para a
-- categoria ANIMAL_JOVEM. Ela agora entra quando — e só quando — o animal é
-- jovem.

begin;

-- ====================================================== a cabeça também tem método

do $$
declare
  v_protocolo uuid;
  v_fonte uuid;
begin
  select id into v_protocolo from public.morfologia_protocolos
   where raca = 'Mangalarga Marchador'
   order by case situacao when 'vigente' then 0 else 1 end, versao desc limit 1;

  select id into v_fonte from public.morfologia_fontes
   where protocolo_id = v_protocolo and tipo = 'REGRA_TECNICA_HARASPRO' limit 1;

  /*
    Metodologia, não regra racial.

    Diz COMO olhar a cabeça — proporção, inserção, o que descrever e o que não
    afirmar. Não diz o que o padrão da raça exige, porque isso continua sem
    documento conferido.
  */
  insert into public.morfologia_conhecimento
    (protocolo_id, fonte_id, categoria, subcategoria, afirmacao, tipo_fonte,
     confianca, situacao)
  select v_protocolo, v_fonte, 'CABECA', 'o que olhar',
         'Ler a cabeça pelo conjunto, não por gosto: proporção com o pescoço e o ' ||
         'tronco, inserção, linha do perfil, amplitude da narina, olho e orelha. ' ||
         'Descrever expressão e proporção; NUNCA afirmar o que o padrão da raça ' ||
         'exige, e nunca declarar medida a partir de foto.',
         'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'
   where not exists (
     select 1 from public.morfologia_conhecimento
      where protocolo_id = v_protocolo and categoria = 'CABECA' and situacao = 'ativo');
end $$;

-- ====================================================== critérios, achatados

/*
  Todos os critérios que os grupos avaliam, numa lista só.

  Existe para a conferência: é com ela que se pergunta "sobrou alguma região
  sem regra de metodologia?" sem repetir o desdobramento dos grupos em cada
  consulta.
*/
create or replace function public.morfologia_grupos_de_analise_criterios()
returns text[]
language sql stable
as $$
  select coalesce(array_agg(distinct c), '{}')
    from public.morfologia_grupos_de_analise() g, unnest(g.criterios) c
$$;

-- ====================================================== pauta com procedência

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

    /*
      Na ordem da autoridade, e cada item dizendo a que regiões serve.

      É `criterios` que permite gravar, em cada nota, só o que valeu para
      aquela região — e responder "com base em quê?" dois anos depois sem
      devolver a base inteira.
    */
    'conhecimento', coalesce((
      select json_agg(json_build_object(
               'conhecimento_id', x.conhecimento_id,
               'categoria', x.categoria,
               'tipo_fonte', x.tipo_fonte,
               'autoridade', x.autoridade,
               'afirmacao', x.afirmacao,
               'fonte', x.fonte,
               'autor', x.autor,
               'criterios', x.criterios)
             order by x.autoridade, x.afirmacao)
        from (
          select k.conhecimento_id, k.tipo_fonte, k.autoridade, k.afirmacao,
                 k.fonte, k.autor, e.categoria,
                 array_agg(distinct e.crit) as criterios
            from (
              select crit, cat as categoria, cat
                from unnest(v_criterios) crit,
                     unnest(public.morfologia_categorias_do_criterio(crit)) cat

              union all

              /*
                Animal em crescimento: a regra vale para o grupo inteiro, e só
                entra quando a idade pede. Estava cadastrada desde a 044 e não
                chegava a lugar nenhum, porque nenhuma região aponta para ela.
              */
              select crit, 'ANIMAL_JOVEM', 'ANIMAL_JOVEM'
                from unnest(v_criterios) crit
               where v_jovem
            ) e (crit, categoria, cat),
                 public.morfologia_conhecimento_do_criterio(v_prot, e.cat) k
           group by k.conhecimento_id, k.tipo_fonte, k.autoridade, k.afirmacao,
                    k.fonte, k.autor, e.categoria
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_pauta(uuid, text)',
    'public.morfologia_grupos_de_analise_criterios()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
