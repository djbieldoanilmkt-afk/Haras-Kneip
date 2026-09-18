-- 057 — O plantel real, vindo da ABCCMM.
--
-- Até aqui o plantel do Kneip eram nove animais que eu inventei para a
-- demonstração. Agora existe a ficha oficial: 91 animais, com registro no SRG,
-- livro, chip, genealogia, 80 cobrições e 84 produtos.
--
-- A CHAVE É O ID DA ABCCMM, NÃO O NOME
--
-- A planilha vai ser puxada de novo toda vez que o plantel mudar. Sem chave
-- estável, cada puxada dobraria o rebanho. O nome não serve: ele pode ser
-- corrigido no registro. O número do SRG também não — dezenove animais não
-- têm. O identificador interno da ABCCMM está nos 91 e não se repete.
--
-- TRÊS TRADUÇÕES QUE O REGISTRO EXIGE
--
-- 1. A ABCCMM põe "Castrado" na coluna SEXO. Aqui sexo é Macho ou Fêmea, e
--    castrado é estado reprodutivo — foi assim que a restrição ficou, e está
--    certo: o animal não deixou de ser macho.
--
-- 2. Pelagem vem em CAIXA ALTA ("TORDILHA"). Vai para a ficha como se lê.
--    "NÃO INFORMADA" não é uma pelagem: vira nulo.
--
-- 3. Em transferência de embrião, a ABCCMM lista a ÉGUA (que é a receptora) e
--    a REPRODUTORA (que é a doadora, mãe genética). Inverter as duas grava o
--    potro com a mãe errada na árvore — é o erro caro deste módulo, e foi por
--    isso que `reproducao.receptora_id` existe desde a 031.
--
-- O QUE NÃO VIRA ANIMAL DO PLANTEL
--
-- Quarenta dos quarenta e dois garanhões das cobrições são de outros haras, e
-- quarenta e sete dos produtos foram vendidos. Garanhão fica em texto, como
-- sempre foi. Produto vendido entra como EXTERNO: conta na produção do
-- reprodutor, mas não no plantel nem no que o agente enxerga.

begin;

-- ====================================================== campos do registro

alter table public.animais
  /* Identificador interno da ABCCMM. É a chave da importação. */
  add column if not exists abccmm_id text,
  add column if not exists registro_livro text,
  add column if not exists registro_categoria text,
  add column if not exists chip text,
  add column if not exists exame_genetico text,
  add column if not exists criador text,
  add column if not exists criador_cidade text,
  add column if not exists data_obito date,
  /* Animal bloqueado na associação não pode ser transferido. */
  add column if not exists bloqueado boolean not null default false;

/* Por haras: o mesmo animal não pode entrar duas vezes, e dois haras podem
   ter fichas de animais diferentes sem colidir. */
create unique index if not exists animais_abccmm_unico
  on public.animais (haras_id, abccmm_id) where abccmm_id is not null;

create index if not exists animais_chip_idx
  on public.animais (haras_id, chip) where chip is not null;

-- ====================================================== leitura do formato

/** Data como a ABCCMM escreve. Vazio e lixo viram nulo, não erro. */
create or replace function public.abccmm_data(p_texto text)
returns date
language plpgsql immutable
as $$
begin
  if nullif(trim(coalesce(p_texto, '')), '') is null then return null; end if;
  return to_date(trim(p_texto), 'DD/MM/YYYY');
exception when others then
  /* Uma data torta numa linha não pode derrubar a importação das outras 90. */
  return null;
end $$;

/** "08/11/2024 a 19/11/2024" -> o começo. */
create or replace function public.abccmm_inicio_do_periodo(p_texto text)
returns date
language sql immutable
as $$
  select public.abccmm_data(split_part(coalesce(p_texto, ''), ' a ', 1))
$$;

/** Pelagem legível. "NÃO INFORMADA" não é pelagem. */
create or replace function public.abccmm_pelagem(p_texto text)
returns text
language sql immutable
as $$
  select case
    when nullif(trim(coalesce(p_texto, '')), '') is null then null
    when public.sem_acento(trim(p_texto)) ilike 'nao informada%' then null
    else initcap(trim(p_texto))
  end
$$;

-- ====================================================== ancestral externo
--
-- `resolver_ancestral` já achava ou criava o animal de fora. Ganha só a
-- origem: importação e conversa do WhatsApp deixam rastros diferentes, e
-- quem for auditar precisa saber de onde o registro veio.

drop function if exists public.resolver_ancestral(uuid, text, text, uuid);

create or replace function public.resolver_ancestral(
  p_haras uuid,
  p_nome text,
  p_sexo text,
  p_user uuid,
  p_origem text default 'whatsapp'
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_id uuid;
begin
  if v_nome is null then
    return null;
  end if;

  select id into v_id
    from public.animais
   where haras_id = p_haras and lower(nome) = lower(v_nome)
   order by externo   -- prefere o do plantel a um externo homonimo
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.animais
    (haras_id, nome, sexo, raca, ativo, externo, criado_por, origem)
  values
    (p_haras, v_nome, p_sexo, 'Mangalarga Marchador', true, true, p_user, p_origem)
  returning id into v_id;

  return v_id;
end $$;

-- ====================================================== animal

create or replace function public.importar_animal_abccmm(
  p_haras uuid, p_user uuid, p_dados jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_sexo_bruto text := trim(coalesce(p_dados ->> 'sexo', ''));
  v_sexo text;
  v_status text;
  v_funcao text;
  v_vivo boolean := coalesce(p_dados ->> 'vivo', 'Sim') <> 'Não';
  v_id uuid;
begin
  if nullif(trim(coalesce(p_dados ->> 'abccmm_id', '')), '') is null then
    raise exception 'A ficha veio sem o identificador da ABCCMM: sem ele a importação duplicaria o animal.';
  end if;

  /* Castrado é estado, não sexo — ver o cabeçalho desta migração. */
  if v_sexo_bruto ilike 'castrad%' then
    v_sexo := 'Macho';
    v_status := 'Castrado';
  elsif v_sexo_bruto ilike 'f%' then
    v_sexo := 'Fêmea';
  else
    v_sexo := 'Macho';
  end if;

  if trim(coalesce(p_dados ->> 'categoria', '')) ilike 'receptora%' then
    v_funcao := 'Receptora';
  end if;

  insert into public.animais
    (haras_id, criado_por, origem, externo, raca,
     abccmm_id, nome, sexo, status_reprodutivo, funcao_reprodutiva,
     registro_abccmm, registro_livro, registro_categoria, chip,
     data_nascimento, pelagem, exame_genetico,
     criador, criador_cidade, ativo, data_obito, bloqueado)
  values
    (p_haras, p_user, 'importacao', false, 'Mangalarga Marchador',
     p_dados ->> 'abccmm_id',
     trim(p_dados ->> 'nome'),
     v_sexo, v_status, v_funcao,
     nullif(trim(coalesce(p_dados ->> 'registro', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'livro', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'categoria', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'chip', '')), ''),
     public.abccmm_data(p_dados ->> 'nascimento'),
     public.abccmm_pelagem(p_dados ->> 'pelagem'),
     nullif(trim(coalesce(p_dados ->> 'exame', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'criador', '')), ''),
     nullif(trim(coalesce(p_dados ->> 'cidade_criador', '')), ''),
     v_vivo,
     public.abccmm_data(p_dados ->> 'data_morte'),
     coalesce(p_dados ->> 'bloqueado', 'Não') = 'Sim')
  /* O predicado repetido não é enfeite: sem ele o Postgres não reconhece o
     índice parcial e recusa o ON CONFLICT. */
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
         /* Um animal já conhecido que reaparece na planilha deixa de ser
            "de fora": ele é do plantel. */
         externo = false,
         updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

-- ====================================================== genealogia da ficha

/** Pai e mãe como vêm na ficha do animal, criando o ancestral de fora. */
create or replace function public.importar_pedigree_abccmm(
  p_haras uuid, p_user uuid, p_animal uuid,
  p_pai text default null, p_mae text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pai uuid;
  v_mae uuid;
begin
  /* "Desconhecido" é como a ABCCMM escreve "não tem": não vira animal. */
  if coalesce(trim(p_pai), '') not in ('', 'Desconhecido') then
    v_pai := public.resolver_ancestral(p_haras, p_pai, 'Macho', p_user, 'importacao');
  end if;
  if coalesce(trim(p_mae), '') not in ('', 'Desconhecido') then
    v_mae := public.resolver_ancestral(p_haras, p_mae, 'Fêmea', p_user, 'importacao');
  end if;

  if v_pai is null and v_mae is null then return; end if;

  insert into public.genealogia (haras_id, animal_id, pai_id, mae_id, criado_por, origem)
  values (p_haras, p_animal, v_pai, v_mae, p_user, 'importacao')
  on conflict (animal_id) do update
     set pai_id = coalesce(excluded.pai_id, public.genealogia.pai_id),
         mae_id = coalesce(excluded.mae_id, public.genealogia.mae_id),
         updated_at = now();
end $$;

-- ====================================================== cobrição

create or replace function public.importar_cobricao_abccmm(
  p_haras uuid, p_user uuid, p_dados jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_te boolean := upper(coalesce(p_dados ->> 'gestacao', '')) = 'TE';
  v_data date := public.abccmm_inicio_do_periodo(p_dados ->> 'periodo');
  v_garanhao text := nullif(trim(coalesce(p_dados ->> 'garanhao', '')), '');
  v_metodo text;
  v_mae uuid;
  v_receptora uuid;
  v_id uuid;
begin
  if v_te then
    /*
      A mãe é a DOADORA. A égua que a ABCCMM lista é quem carregou.

      Quando a planilha não traz a reprodutora, não dá para saber de quem é o
      embrião: a égua fica como mãe e o registro sai honesto, sem inventar
      uma doadora.
    */
    v_metodo := 'Transferência de Embrião';
    v_mae := public.resolver_ancestral(
      p_haras, p_dados ->> 'reprodutora', 'Fêmea', p_user, 'importacao');
    v_receptora := public.resolver_ancestral(
      p_haras, p_dados ->> 'egua', 'Fêmea', p_user, 'importacao');
    if v_mae is null then
      v_mae := v_receptora;
      v_receptora := null;
    end if;

    /*
      A mesma égua nas duas colunas.

      A ABCCMM repete a égua no campo Reprodutora em quase metade das
      cobrições. Quando isso acontece não existe receptora distinta: ela é
      simplesmente a mãe. Gravar as duas iguais esbarraria em
      `reproducao_receptora_diferente` — e a restrição está certa: receptora é
      OUTRA égua, senão o campo não quer dizer nada.
    */
    if v_receptora = v_mae then
      v_receptora := null;
    end if;
  else
    v_metodo := 'Monta Natural';
    v_mae := public.resolver_ancestral(
      p_haras, p_dados ->> 'egua', 'Fêmea', p_user, 'importacao');
  end if;

  if v_mae is null then
    raise exception 'Cobrição sem égua identificada: %', p_dados;
  end if;

  /* Reimportar a planilha não pode multiplicar o histórico reprodutivo. */
  select id into v_id from public.reproducao
   where haras_id = p_haras
     and animal_id = v_mae
     and data_evento is not distinct from v_data
     and coalesce(garanhao, '') = coalesce(v_garanhao, '')
     and excluido_em is null
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.reproducao
    (haras_id, criado_por, origem, animal_id, receptora_id,
     tipo, metodo, garanhao, data_evento, observacoes)
  values
    (p_haras, p_user, 'importacao', v_mae, v_receptora,
     'Cobertura', v_metodo, v_garanhao, v_data,
     nullif(trim(coalesce(p_dados ->> 'periodo', '')), ''))
  returning id into v_id;

  return v_id;
end $$;

-- ====================================================== produto

/*
  Um filho, e de quem ele é.

  A planilha da ABCCMM lista a descendência ficha a ficha, então cada linha
  traz UM progenitor. Gravar o lado certo e não apagar o outro é o que faz as
  duas linhas do mesmo potro se somarem em vez de se sobrescreverem.
*/
create or replace function public.importar_produto_abccmm(
  p_haras uuid, p_user uuid, p_dados jsonb
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_sexo text := case when trim(coalesce(p_dados ->> 'sexo', '')) ilike 'f%'
                      then 'Fêmea' else 'Macho' end;
  v_produto uuid;
  v_prog uuid;
  v_sexo_prog text;
begin
  v_produto := public.resolver_ancestral(
    p_haras, p_dados ->> 'produto', v_sexo, p_user, 'importacao');
  v_prog := public.resolver_ancestral(
    p_haras, p_dados ->> 'progenitor', 'Fêmea', p_user, 'importacao');

  if v_produto is null or v_prog is null then
    return null;
  end if;

  /* O que a ficha do produto acrescenta ao que já existe. Nunca sobrescreve o
     que veio do plantel: lá o dado é de primeira mão. */
  update public.animais
     set data_nascimento = coalesce(data_nascimento, public.abccmm_data(p_dados ->> 'nascimento')),
         registro_abccmm = coalesce(registro_abccmm,
                                    nullif(trim(coalesce(p_dados ->> 'registro', '')), '')),
         registro_livro = coalesce(registro_livro,
                                   nullif(trim(coalesce(p_dados ->> 'livro', '')), '')),
         updated_at = now()
   where id = v_produto;

  select sexo into v_sexo_prog from public.animais where id = v_prog;

  insert into public.genealogia (haras_id, animal_id, pai_id, mae_id, criado_por, origem)
  values (p_haras, v_produto,
          case when v_sexo_prog = 'Macho' then v_prog end,
          case when v_sexo_prog = 'Fêmea' then v_prog end,
          p_user, 'importacao')
  on conflict (animal_id) do update
     set pai_id = coalesce(excluded.pai_id, public.genealogia.pai_id),
         mae_id = coalesce(excluded.mae_id, public.genealogia.mae_id),
         updated_at = now();

  return v_produto;
end $$;

-- ====================================================== acesso

do $$
declare f text;
begin
  foreach f in array array[
    'public.importar_animal_abccmm(uuid, uuid, jsonb)',
    'public.importar_pedigree_abccmm(uuid, uuid, uuid, text, text)',
    'public.importar_cobricao_abccmm(uuid, uuid, jsonb)',
    'public.importar_produto_abccmm(uuid, uuid, jsonb)',
    'public.resolver_ancestral(uuid, text, text, uuid, text)',
    'public.abccmm_data(text)',
    'public.abccmm_inicio_do_periodo(text)',
    'public.abccmm_pelagem(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
