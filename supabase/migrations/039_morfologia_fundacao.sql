-- 039 — Avaliação Morfológica: fundação (recurso por tenant + esquema).
--
-- Módulo exclusivo do Haras Kneip, ligado por FEATURE FLAG — nunca por
-- comparação de nome. `haras_features` é a chave, e a checagem mora no RLS:
-- desligar o recurso apaga o módulo do banco para aquele haras, não só da
-- tela. Frontend escondendo botão é cortesia; quem barra é o banco.
--
-- PRIVACIDADE, QUE AQUI É O PONTO DELICADO
--
-- A avaliação pertence a QUEM AVALIOU, não ao animal. O Kneip pode avaliar um
-- cavalo de terceiro chamado "Imperador"; outro cliente do HarasPro pode ter
-- o próprio "Imperador". O segundo não enxerga nada do primeiro — nem nota,
-- nem foto, nem PDF. Por isso `owner_haras_id` em TODA tabela do módulo, e
-- não só na raiz: consulta que esquece a junção ainda esbarra no RLS.
--
-- NOMES EM PORTUGUÊS, como o resto do banco (despesas, receitas, eventos). A
-- especificação sugeriu nomes em inglês mas mandou seguir o padrão existente.

begin;

-- ====================================================== recurso por tenant

create table if not exists public.haras_recursos (
  haras_id uuid not null references public.haras(id) on delete cascade,
  recurso text not null,
  ativo boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (haras_id, recurso)
);

comment on table public.haras_recursos is
  'Modulos liberados por haras. Nunca comparar nome do haras no codigo.';

alter table public.haras_recursos enable row level security;

drop policy if exists haras_recursos_sel on public.haras_recursos;
create policy haras_recursos_sel on public.haras_recursos for select to authenticated
  using (haras_id = public.meu_haras_id());

revoke insert, update, delete on public.haras_recursos from anon, authenticated;

/*
  O recurso está ligado para o haras da sessão?

  `stable` e sem parâmetro de haras: quem chama é o RLS, e deixar o haras como
  parâmetro seria oferecer a chave junto com a fechadura.
*/
create or replace function public.tem_recurso(p_recurso text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.haras_recursos
     where haras_id = public.meu_haras_id()
       and recurso = p_recurso
       and ativo
  )
$$;

/** Mesma pergunta, para o agente — que recebe o usuário por parâmetro. */
create or replace function public.tem_recurso_do_usuario(p_user uuid, p_recurso text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.haras_recursos r
    join public.membros m on m.haras_id = r.haras_id
     where m.user_id = p_user
       and r.recurso = p_recurso
       and r.ativo
  )
$$;

/*
  Permissão por ação, mapeada nos papéis que o produto já tem.

  A especificação pede morphology:create, :view, :manage... Um sistema de ACL
  novo conviveria mal com o resto do app, que decide por papel. Traduzo as
  ações para os papéis existentes e deixo a lista explícita — assim a intenção
  fica no código, e não na cabeça de quem leu a especificação.
*/
create or replace function public.pode_morfologia(p_user uuid, p_acao text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when not public.tem_recurso_do_usuario(p_user, 'avaliacao_morfologica') then false
    else exists (
      select 1 from public.membros m
       where m.user_id = p_user
         and case p_acao
           -- Peão registra e consulta: é quem está com o cavalo na mão.
           when 'criar'   then m.papel in ('dono', 'gerente', 'peao')
           when 'ver'     then m.papel in ('dono', 'gerente', 'peao')
           when 'relatorio' then m.papel in ('dono', 'gerente', 'peao')
           -- Apagar e configurar ficam com quem responde pela conta.
           when 'apagar'  then m.papel in ('dono', 'gerente')
           when 'gerir'   then m.papel = 'dono'
           else false
         end
    )
  end
$$;

-- ====================================================== protocolo da raça

create table if not exists public.morfologia_protocolos (
  id uuid primary key default gen_random_uuid(),
  raca text not null,
  versao text not null,
  /* Critérios, pesos e regras. Estrutura em JSON para versionar sem migração
     a cada ajuste do padrão. */
  criterios jsonb not null,
  pesos jsonb not null,
  regras_jovens jsonb not null default '{}'::jsonb,
  /* Procedência: sem isto o protocolo vira "o que o modelo achou". */
  fonte_nome text,
  fonte_referencia text,
  fonte_data date,
  revisado_em date,
  /* Enquanto o padrão oficial não for conferido linha a linha, o protocolo
     nasce em rascunho e a avaliação diz isso no relatório. */
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho', 'vigente', 'aposentado')),
  criado_em timestamptz not null default now(),
  unique (raca, versao)
);

alter table public.morfologia_protocolos enable row level security;
drop policy if exists morfologia_protocolos_sel on public.morfologia_protocolos;
-- Protocolo é conhecimento da raça, não dado de haras: todo mundo com o
-- recurso ligado lê o mesmo.
create policy morfologia_protocolos_sel on public.morfologia_protocolos
  for select to authenticated
  using (public.tem_recurso('avaliacao_morfologica'));
revoke insert, update, delete on public.morfologia_protocolos from anon, authenticated;

-- ====================================================== avaliações

create table if not exists public.morfologia_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  protocolo_id uuid references public.morfologia_protocolos(id),

  estado text not null default 'INICIADA',
  origem text not null default 'whatsapp' check (origem in ('app', 'whatsapp')),

  finalidade text,
  observacoes text,

  /* Resultado consolidado. Nulo enquanto não processou. */
  nota_geral numeric(4, 1),
  confianca numeric(4, 1),
  qualidade_material int,
  potencial text,
  nota_projetada numeric(4, 1),
  confianca_projecao numeric(4, 1),

  resumo text,
  conclusao text,
  analise jsonb,

  erro text,
  custo_total_usd numeric(10, 4) not null default 0,

  criado_por uuid references auth.users(id),
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.morfologia_avaliacoes
  drop constraint if exists morfologia_avaliacoes_estado_check;
alter table public.morfologia_avaliacoes add constraint morfologia_avaliacoes_estado_check
  check (estado in (
    'INICIADA', 'ESCOLHER_ANIMAL', 'CONFIRMAR_ANIMAL', 'COLETAR_DADOS',
    'PEDIR_LATERAL_ESQ', 'PEDIR_LATERAL_DIR', 'PEDIR_FRENTE', 'PEDIR_TRASEIRA',
    'PEDIR_CABECA_FRENTE', 'PEDIR_CABECA_PERFIL',
    'PEDIR_VIDEO_360', 'PEDIR_VIDEO_FRENTE_TRAS', 'PEDIR_VIDEO_LATERAL',
    'VALIDANDO_MIDIA', 'PRONTA_PARA_PROCESSAR', 'PROCESSANDO',
    'GERANDO_RELATORIO', 'CONCLUIDA', 'CANCELADA', 'FALHOU'
  ));

create index if not exists morfologia_avaliacoes_haras_idx
  on public.morfologia_avaliacoes (owner_haras_id, iniciada_em desc);
create index if not exists morfologia_avaliacoes_estado_idx
  on public.morfologia_avaliacoes (estado);

-- ====================================================== sujeito avaliado

create table if not exists public.morfologia_sujeitos (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  tipo text not null check (tipo in ('ANIMAL_CADASTRADO', 'ANIMAL_EXTERNO')),
  /*
    NULO de propósito: o Kneip avalia cavalo de terceiro, potro que pretende
    comprar, visitante. Exigir animal_id excluiria o caso mais valioso —
    avaliar antes de comprar.
  */
  animal_id uuid references public.animais(id) on delete set null,

  nome text not null,
  raca text,
  sexo text,
  data_nascimento date,
  idade_meses_na_avaliacao int,
  castracao text,
  proprietario text,

  altura_cernelha_cm numeric(5, 1),
  altura_garupa_cm numeric(5, 1),
  comprimento_corporal_cm numeric(5, 1),
  perimetro_toracico_cm numeric(5, 1),

  cascos text,
  ultimo_casqueamento text,
  historico_lesoes text,
  locomocao text,
  treinamento text,
  gestante_lactante text,
  pedigree jsonb,

  /*
    Fotografia dos dados NA DATA da avaliação.

    Mesmo com animal_id, o cadastro muda: o potro cresce, a altura é
    remedida, o nome é corrigido. Sem o instantâneo, um relatório de dois anos
    atrás passaria a descrever um animal que não existia naquele dia.
  */
  instantaneo jsonb not null default '{}'::jsonb,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (avaliacao_id)
);

create index if not exists morfologia_sujeitos_animal_idx
  on public.morfologia_sujeitos (animal_id);
create index if not exists morfologia_sujeitos_haras_idx
  on public.morfologia_sujeitos (owner_haras_id);

-- ====================================================== mídias

create table if not exists public.morfologia_midias (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  papel text not null check (papel in (
    'LATERAL_ESQ', 'LATERAL_DIR', 'FRENTE', 'TRASEIRA',
    'CABECA_FRENTE', 'CABECA_PERFIL',
    'VIDEO_360', 'VIDEO_FRENTE_TRAS', 'VIDEO_LATERAL', 'EXTRA'
  )),
  tipo text not null check (tipo in ('foto', 'video')),

  caminho text not null,
  mime text,
  bytes bigint,
  largura int,
  altura int,
  duracao_seg numeric(6, 2),

  validacao text check (validacao in ('ACEITA', 'REPETIR_RECOMENDADO', 'RECUSADA')),
  codigos_problema text[] not null default '{}',
  observacao_validacao text,
  /* Substituída por um reenvio: fica no banco para a trilha, fora da análise. */
  substituida boolean not null default false,

  criado_em timestamptz not null default now()
);

create index if not exists morfologia_midias_avaliacao_idx
  on public.morfologia_midias (avaliacao_id, papel);
create index if not exists morfologia_midias_haras_idx
  on public.morfologia_midias (owner_haras_id);

-- ====================================================== frames de vídeo

create table if not exists public.morfologia_frames (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  midia_id uuid not null references public.morfologia_midias(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  segundo numeric(6, 2) not null,
  caminho text not null,
  nitidez numeric(6, 2),
  selecionado boolean not null default false,
  motivo_descarte text,
  criado_em timestamptz not null default now()
);

create index if not exists morfologia_frames_midia_idx
  on public.morfologia_frames (midia_id, segundo);
create index if not exists morfologia_frames_avaliacao_idx
  on public.morfologia_frames (avaliacao_id) where selecionado;
create index if not exists morfologia_frames_haras_idx
  on public.morfologia_frames (owner_haras_id);

-- ====================================================== notas por critério

create table if not exists public.morfologia_notas (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  criterio text not null,
  etapa text not null default 'final' check (etapa in ('primaria', 'revisao', 'final')),

  nota numeric(4, 1) not null,
  confianca numeric(4, 1),
  peso numeric(5, 2),
  nota_ponderada numeric(6, 2),
  situacao text,

  pontos_fortes text[] not null default '{}',
  pontos_atencao text[] not null default '{}',
  analise text,
  evidencias jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now(),
  unique (avaliacao_id, criterio, etapa)
);

create index if not exists morfologia_notas_avaliacao_idx
  on public.morfologia_notas (avaliacao_id, etapa);
create index if not exists morfologia_notas_haras_idx
  on public.morfologia_notas (owner_haras_id);

-- ====================================================== relatórios

create table if not exists public.morfologia_relatorios (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  caminho text not null,
  arquivo text not null,
  bytes bigint,
  gerado_em timestamptz not null default now()
);

create index if not exists morfologia_relatorios_avaliacao_idx
  on public.morfologia_relatorios (avaliacao_id, gerado_em desc);
create index if not exists morfologia_relatorios_haras_idx
  on public.morfologia_relatorios (owner_haras_id);

-- ====================================================== custo de IA

create table if not exists public.morfologia_uso_ia (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid references public.morfologia_avaliacoes(id) on delete cascade,

  etapa text not null,
  provedor text not null default 'openrouter',
  modelo text not null,
  tokens_entrada int,
  tokens_saida int,
  /* Estimado é chute; real vem do provedor. Guardo os dois e prefiro o real. */
  custo_estimado_usd numeric(10, 6),
  custo_real_usd numeric(10, 6),
  duracao_ms int,
  criado_em timestamptz not null default now()
);

create index if not exists morfologia_uso_ia_avaliacao_idx
  on public.morfologia_uso_ia (avaliacao_id);
create index if not exists morfologia_uso_ia_haras_idx
  on public.morfologia_uso_ia (owner_haras_id, criado_em desc);

-- ====================================================== sessão do WhatsApp

create table if not exists public.morfologia_sessoes (
  telefone text primary key,
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,
  user_id uuid references auth.users(id),
  /*
    Sem validade: a coleta atravessa dias. "Mando as fotos amanhã" é o caso
    normal, não a exceção — e a conversa comum expira em 30 minutos.
  */
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index if not exists morfologia_sessoes_avaliacao_idx
  on public.morfologia_sessoes (avaliacao_id);

-- ====================================================== fila de trabalho

/*
  Fila própria, porque o projeto não tem nenhuma.

  Vídeo, IA e PDF não podem rodar dentro do webhook: a Evolution corta a
  espera e reenvia o evento, e o efeito aconteceria duas vezes. O disparo usa
  o pg_cron que já move o resumo matinal.
*/
create table if not exists public.morfologia_tarefas (
  id uuid primary key default gen_random_uuid(),
  owner_haras_id uuid not null references public.haras(id) on delete cascade,
  avaliacao_id uuid not null references public.morfologia_avaliacoes(id) on delete cascade,

  tipo text not null check (tipo in (
    'PROCESSAR_MIDIA', 'SELECIONAR_FRAMES', 'ANALISE_PRIMARIA',
    'ANALISE_REVISAO', 'RECONCILIAR', 'GERAR_RELATORIO', 'ENVIAR_WHATSAPP'
  )),
  situacao text not null default 'na_fila'
    check (situacao in ('na_fila', 'processando', 'concluida', 'falhou')),

  tentativas int not null default 0,
  erro text,
  payload jsonb not null default '{}'::jsonb,

  /* Uma tarefa por tipo e avaliação: reenvio do webhook não duplica trabalho. */
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  unique (avaliacao_id, tipo)
);

create index if not exists morfologia_tarefas_fila_idx
  on public.morfologia_tarefas (situacao, criado_em) where situacao in ('na_fila', 'processando');

-- ====================================================== RLS do módulo
--
-- Duas condições em toda política: o haras da sessão E o recurso ligado.
-- Desligar o recurso faz o módulo sumir do banco, não só da tela.

do $$
declare t text;
begin
  foreach t in array array[
    'morfologia_avaliacoes', 'morfologia_sujeitos', 'morfologia_midias',
    'morfologia_frames', 'morfologia_notas', 'morfologia_relatorios',
    'morfologia_uso_ia', 'morfologia_sessoes', 'morfologia_tarefas'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format($f$
      create policy %1$I on public.%2$I for select to authenticated
        using (owner_haras_id = public.meu_haras_id()
               and public.tem_recurso('avaliacao_morfologica'))
    $f$, t || '_sel', t);

    -- Escrita é do service_role (agente e trabalhadores). A tela lê e dispara
    -- por funcao; nao insere direto.
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;
