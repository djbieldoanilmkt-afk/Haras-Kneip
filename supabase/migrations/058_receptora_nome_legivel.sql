-- 058 — Receptora tem nome de gente, e fica fora da vitrine.
--
-- A ABCCMM identifica égua receptora como "13 - 982000192320700": o número
-- interno do haras, um traço, e o microchip. Isso não é nome — é identificador
-- com o chip embutido. No catálogo virava uma fileira de cartões dizendo
-- "13 - 982000192320700 · Tordilha · Desconhecida", e a idade aparece
-- desconhecida porque a associação não guarda nascimento de receptora.
--
-- NADA SE PERDE AO RENOMEAR
--
-- O chip já tem coluna própria desde a 057, e o mesmo vale para o registro no
-- SRG e para o identificador interno da associação. O número do haras — que é
-- por onde o peão chama a égua no curral — fica no nome. Então "Receptora 13"
-- carrega tudo que "13 - 982000192320700" carregava, e se lê.
--
-- POR QUE A REGRA MORA NA IMPORTAÇÃO
--
-- Um UPDATE avulso seria desfeito na próxima vez que a planilha fosse puxada:
-- `importar_animal_abccmm` sobrescreve o nome. Aqui a tradução acontece na
-- entrada, toda vez, e o resultado é o mesmo.
--
-- E A VITRINE
--
-- O link do plantel vai para comprador. Receptora não está à venda e não é do
-- padrão da raça: entra no sistema, não na vitrine. Mas curadoria que o dono
-- fez à mão não é revertida — se ele tirou um animal de lá, a planilha
-- seguinte não o coloca de volta.

begin;

/*
  O nome como se fala, para quem a associação só numera.

  Só age sobre receptora, e só quando o nome tem a forma "<algo> - <chip>".
  Qualquer outra coisa passa intacta — inclusive nome de receptora que já
  venha legível.
*/
create or replace function public.abccmm_nome_de_exibicao(
  p_nome text, p_categoria text
)
returns text
language plpgsql immutable
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_prefixo text;
begin
  if v_nome = '' or coalesce(p_categoria, '') not ilike 'receptora%' then
    return nullif(v_nome, '');
  end if;

  /* "<prefixo> - <chip de 9 ou mais digitos>" */
  v_prefixo := substring(v_nome from '^(.+?)\s*-\s*\d{9,}$');
  if v_prefixo is null then
    return v_nome;
  end if;

  v_prefixo := trim(v_prefixo);

  /* Só número: precisa da palavra na frente para virar nome. Tendo nome
     próprio (BRIA, ONZE), ele basta. */
  if v_prefixo ~ '^\d+$' then
    return 'Receptora ' || v_prefixo;
  end if;

  return initcap(v_prefixo);
end $$;

create or replace function public.importar_animal_abccmm(
  p_haras uuid, p_user uuid, p_dados jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_sexo_bruto text := trim(coalesce(p_dados ->> 'sexo', ''));
  v_categoria text := trim(coalesce(p_dados ->> 'categoria', ''));
  v_sexo text;
  v_status text;
  v_funcao text;
  v_receptora boolean := v_categoria ilike 'receptora%';
  v_vivo boolean := coalesce(p_dados ->> 'vivo', 'Sim') <> 'Não';
  v_id uuid;
begin
  if nullif(trim(coalesce(p_dados ->> 'abccmm_id', '')), '') is null then
    raise exception 'A ficha veio sem o identificador da ABCCMM: sem ele a importação duplicaria o animal.';
  end if;

  /* Castrado é estado, não sexo — ver o cabeçalho da 057. */
  if v_sexo_bruto ilike 'castrad%' then
    v_sexo := 'Macho';
    v_status := 'Castrado';
  elsif v_sexo_bruto ilike 'f%' then
    v_sexo := 'Fêmea';
  else
    v_sexo := 'Macho';
  end if;

  if v_receptora then
    v_funcao := 'Receptora';
  end if;

  insert into public.animais
    (haras_id, criado_por, origem, externo, raca,
     abccmm_id, nome, sexo, status_reprodutivo, funcao_reprodutiva,
     registro_abccmm, registro_livro, registro_categoria, chip,
     data_nascimento, pelagem, exame_genetico,
     criador, criador_cidade, ativo, data_obito, bloqueado, em_destaque)
  values
    (p_haras, p_user, 'importacao', false, 'Mangalarga Marchador',
     p_dados ->> 'abccmm_id',
     public.abccmm_nome_de_exibicao(p_dados ->> 'nome', v_categoria),
     v_sexo, v_status, v_funcao,
     nullif(trim(coalesce(p_dados ->> 'registro', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'livro', '')), ''),
     nullif(v_categoria, ''),
     nullif(trim(coalesce(p_dados ->> 'chip', '')), ''),
     public.abccmm_data(p_dados ->> 'nascimento'),
     public.abccmm_pelagem(p_dados ->> 'pelagem'),
     nullif(trim(coalesce(p_dados ->> 'exame', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'criador', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'cidade_criador', '')), ''),
     v_vivo,
     public.abccmm_data(p_dados ->> 'data_morte'),
     coalesce(p_dados ->> 'bloqueado', 'Não') = 'Sim',
     not v_receptora)
  on conflict (haras_id, abccmm_id) where abccmm_id is not null do update
     set nome = excluded.nome,
         sexo = excluded.sexo,
         status_reprodutivo = coalesce(excluded.status_reprodutivo, public.animais.status_reprodutivo),
         funcao_reprodutiva = coalesce(excluded.funcao_reprodutiva, public.animais.funcao_reprodutiva),
         registro_abccmm = coalesce(excluded.registro_abccmm, public.animais.registro_abccmm),
         registro_livro = coalesce(excluded.registro_livro, public.animais.registro_livro),
         registro_categoria = coalesce(excluded.registro_categoria, public.animais.registro_categoria),
         chip = coalesce(excluded.chip, public.animais.chip),
         data_nascimento = coalesce(excluded.data_nascimento, public.animais.data_nascimento),
         pelagem = coalesce(excluded.pelagem, public.animais.pelagem),
         exame_genetico = coalesce(excluded.exame_genetico, public.animais.exame_genetico),
         criador = coalesce(excluded.criador, public.animais.criador),
         criador_cidade = coalesce(excluded.criador_cidade, public.animais.criador_cidade),
         ativo = excluded.ativo,
         data_obito = coalesce(excluded.data_obito, public.animais.data_obito),
         bloqueado = excluded.bloqueado,
         /*
           Receptora sai da vitrine sempre. Para os outros, a escolha é do
           dono: se ele tirou um animal de lá, a planilha seguinte não o
           devolve.
         */
         em_destaque = case when excluded.funcao_reprodutiva = 'Receptora'
                            then false else public.animais.em_destaque end,
         externo = false,
         updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.abccmm_nome_de_exibicao(text, text)
  from public, anon, authenticated;
grant execute on function public.abccmm_nome_de_exibicao(text, text) to service_role;

commit;
