-- 050 — A nota é do banco, não do modelo.
--
-- ESTA É A LINHA QUE NÃO PODE SER ATRAVESSADA
--
-- O modelo olha uma região e diz "garupa, 7,5, porque…". Isso é leitura de
-- imagem, e é para isso que ele serve. A NOTA GERAL, o peso de cada região, o
-- que fazer quando duas leituras discordam e o que dizer sobre um potro são
-- decisões de método — e método é revisável, auditável e igual toda vez. Se o
-- modelo somasse, duas avaliações do mesmo cavalo dariam números diferentes e
-- ninguém saberia por quê.
--
-- Por isso: `morfologia_registrar_nota` recebe UMA nota de UMA região, confere
-- contra o protocolo e calcula o peso sozinha. `morfologia_reconciliar` faz o
-- resto sem perguntar nada a ninguém.
--
-- DUAS LEITURAS, E O QUE FAZER QUANDO ELAS BRIGAM
--
-- A mesma região é lida duas vezes, em passadas independentes. Perto uma da
-- outra, vira média. Longe, ganha a mais confiante — e, no empate, a MENOR.
-- Nota inflada num cavalo que alguém está pensando em comprar é o erro caro;
-- nota conservadora num cavalo bom se corrige com uma segunda olhada.

begin;

/* Até onde duas leituras podem discordar e ainda serem "a mesma leitura". */
create or replace function public.morfologia_tolerancia()
returns numeric language sql immutable as $$ select 1.0::numeric $$;

-- ====================================================== peso do critério

/*
  O peso de uma região, ou NULO se ela não existe no protocolo.

  Nulo é a trava contra critério inventado: o modelo devolve o nome da região
  junto com a nota, e "temperamento" — que este protocolo não avalia — entraria
  numa gaveta sem peso e sem descrição.
*/
create or replace function public.morfologia_peso(p_protocolo uuid, p_criterio text)
returns numeric
language sql stable
as $$
  select coalesce((p.pesos ->> p_criterio)::numeric, 1)
    from public.morfologia_protocolos p
   where p.id = p_protocolo
     and exists (
       select 1 from jsonb_array_elements(p.criterios) c
        where c ->> 'chave' = p_criterio)
$$;

-- ====================================================== gravar uma nota

create or replace function public.morfologia_registrar_nota(
  p_avaliacao uuid,
  p_criterio text,
  p_etapa text,
  p_nota numeric,
  p_confianca numeric default null,
  p_pontos_fortes text[] default '{}',
  p_pontos_atencao text[] default '{}',
  p_analise text default null,
  p_evidencias jsonb default '[]'::jsonb,
  p_conhecimento_ids uuid[] default '{}'
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

  v_peso := public.morfologia_peso(v_prot, p_criterio);
  if v_peso is null then
    raise exception 'O critério "%" não existe no protocolo desta avaliação.', p_criterio;
  end if;

  insert into public.morfologia_notas
    (owner_haras_id, avaliacao_id, criterio, etapa, nota, confianca, peso,
     nota_ponderada, pontos_fortes, pontos_atencao, analise, evidencias,
     conhecimento_ids)
  values
    (v_haras, p_avaliacao, p_criterio, p_etapa, p_nota, p_confianca, v_peso,
     p_nota * v_peso, coalesce(p_pontos_fortes, '{}'), coalesce(p_pontos_atencao, '{}'),
     p_analise, coalesce(p_evidencias, '[]'::jsonb), coalesce(p_conhecimento_ids, '{}'))
  on conflict (avaliacao_id, criterio, etapa) do update
     set nota = excluded.nota,
         confianca = excluded.confianca,
         peso = excluded.peso,
         nota_ponderada = excluded.nota_ponderada,
         pontos_fortes = excluded.pontos_fortes,
         pontos_atencao = excluded.pontos_atencao,
         analise = excluded.analise,
         evidencias = excluded.evidencias,
         conhecimento_ids = excluded.conhecimento_ids
  returning id into v_id;

  return v_id;
end $$;

-- ====================================================== qualidade do material

/*
  Quanto do material pedido chegou, e em que estado.

  Entra no laudo porque uma nota tirada de seis fotos boas e uma nota tirada de
  três fotos tremidas não valem o mesmo — e quem lê precisa saber disso sem ter
  de abrir as imagens.
*/
create or replace function public.morfologia_qualidade_material(p_aval uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select least(100, round(100.0 * coalesce(sum(
           case m.validacao
             when 'ACEITA' then 1.0
             /* Serve, mas o quadro é pior: conta menos, não conta zero. */
             when 'REPETIR_RECOMENDADO' then 0.6
             else 0
           end), 0)
         / greatest(cardinality(public.morfologia_ordem()), 1)))::int
    from public.morfologia_midias m
   where m.avaliacao_id = p_aval
     and not m.substituida
     and m.papel <> 'EXTRA'
$$;

-- ====================================================== reconciliar

/*
  Junta as duas leituras, escreve a nota final de cada região e fecha a nota
  geral. Pode rodar quantas vezes for preciso: apaga as finais antes de
  escrever, então reprocessar não empilha.
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
     evidencias, conhecimento_ids)
  select
    v_haras, p_aval, x.criterio, 'final', x.nota, x.confianca, x.peso,
    x.nota * x.peso, x.situacao,
    x.pontos_fortes, x.pontos_atencao, x.analise, x.evidencias, x.conhecimento_ids
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
    'qualidade_material', public.morfologia_qualidade_material(p_aval),
    'nota_projetada', v_proj,
    'potencial', v_potencial);
end $$;

-- ====================================================== custo

/*
  Cada chamada de IA vira linha, e o total sobe para a avaliação.

  Somar na avaliação em vez de calcular na hora de mostrar: o custo é o número
  que decide se o módulo se paga, e ele precisa estar do lado da avaliação
  quando alguém olhar a lista inteira.
*/
create or replace function public.morfologia_registrar_uso(
  p_avaliacao uuid,
  p_etapa text,
  p_modelo text,
  p_tokens_entrada int default null,
  p_tokens_saida int default null,
  p_custo_usd numeric default null,
  p_duracao_ms int default null,
  p_provedor text default 'openrouter'
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

  insert into public.morfologia_uso_ia
    (owner_haras_id, avaliacao_id, etapa, provedor, modelo,
     tokens_entrada, tokens_saida, custo_real_usd, duracao_ms)
  values
    (v_haras, p_avaliacao, p_etapa, p_provedor, p_modelo,
     p_tokens_entrada, p_tokens_saida, p_custo_usd, p_duracao_ms)
  returning id into v_id;

  update public.morfologia_avaliacoes a
     set custo_total_usd = (
           select coalesce(sum(coalesce(u.custo_real_usd, u.custo_estimado_usd, 0)), 0)
             from public.morfologia_uso_ia u where u.avaliacao_id = p_avaliacao)
   where a.id = p_avaliacao;

  return v_id;
end $$;

-- ====================================================== acesso

do $$
declare f text;
begin
  foreach f in array array[
    'public.morfologia_peso(uuid, text)',
    'public.morfologia_registrar_nota(uuid, text, text, numeric, numeric, text[], text[], text, jsonb, uuid[])',
    'public.morfologia_qualidade_material(uuid)',
    'public.morfologia_reconciliar(uuid)',
    'public.morfologia_registrar_uso(uuid, text, text, int, int, numeric, int, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
