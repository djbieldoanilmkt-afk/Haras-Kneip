-- 035 — Evento vira centro de custo.
--
-- Seu Hélio, olhando o calendário: "aqui você pode criar eventos. Copa de
-- Março. Aí no evento, para quê? Para a gente saber a despesa do evento:
-- carreto, alimentação, custo de inscrição dos animais. Eu tenho 5 eventos —
-- cada evento, eu tenho quanto gastei."
--
-- Hoje `eventos` é só agenda e `despesas` não conhece evento nenhum. Não há
-- como responder "quanto custou a Copa de Março", que é a pergunta que decide
-- se vale voltar no ano que vem.
--
-- REUSAR `eventos`, E NÃO CRIAR TABELA NOVA
--
-- Ele falou disso olhando o calendário, chamando de "evento". Uma tabela
-- separada de "competições" criaria duas coisas com o mesmo nome no mesmo
-- produto — e a Copa de Março TAMBÉM é um compromisso de agenda: tem data,
-- precisa aparecer no calendário, e o haras se organiza por ela.
--
-- O RATEIO JÁ EXISTE
--
-- O carreto de 800 reais para três cavalos são ~266 por cabeça no custo de
-- cada um. Isso é exatamente `despesa_rateios`, que já divide em centavos
-- exatos. Evento não precisa de mecanismo próprio: precisa saber QUAIS animais
-- foram, para o rateio já vir preenchido.

begin;

-- Competição e exposição entram na lista fechada, alinhadas com TIPOS_EVENTO
-- em src/lib/status.ts. Mexeu numa, mexa na outra.
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in (
    'Vacinação', 'Vermifugação', 'Parto Previsto', 'Ferração',
    'Veterinário', 'Cobertura', 'Competição', 'Exposição', 'Outro'
  ));

/*
  A despesa aponta para o evento.

  `on delete set null`: apagar a Copa de Março não pode sumir com o carreto de
  800 reais que foi pago de verdade. O dinheiro saiu; ele só deixa de estar
  agrupado.
*/
alter table public.despesas
  add column if not exists evento_id uuid references public.eventos(id) on delete set null;

create index if not exists despesas_evento_idx on public.despesas (evento_id);

comment on column public.despesas.evento_id is
  'Agrupa a despesa num evento (Copa de Marco). Apagar o evento nao apaga a despesa.';

/*
  Quais animais foram.

  Serve a duas coisas: saber quem competiu, e preencher o rateio sozinho
  quando a despesa é do evento — sem isso, quem lança o carreto teria de
  remarcar os mesmos três animais em cada nota.
*/
create table if not exists public.evento_animais (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete cascade,
  haras_id uuid not null references public.haras(id) on delete cascade,
  -- Resultado da prova, quando houver: "Campeã Jovem", "3º lugar".
  resultado text,
  created_at timestamptz not null default now(),
  primary key (evento_id, animal_id)
);

create index if not exists evento_animais_animal_idx on public.evento_animais (animal_id);
create index if not exists evento_animais_haras_idx on public.evento_animais (haras_id);

alter table public.evento_animais enable row level security;

drop policy if exists evento_animais_sel on public.evento_animais;
drop policy if exists evento_animais_ins on public.evento_animais;
drop policy if exists evento_animais_upd on public.evento_animais;
drop policy if exists evento_animais_del on public.evento_animais;

create policy evento_animais_sel on public.evento_animais for select to authenticated
  using (haras_id = public.meu_haras_id());
create policy evento_animais_ins on public.evento_animais for insert to authenticated
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id));
create policy evento_animais_upd on public.evento_animais for update to authenticated
  using (haras_id = public.meu_haras_id())
  with check (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id));
create policy evento_animais_del on public.evento_animais for delete to authenticated
  using (haras_id = public.meu_haras_id() and public.haras_escreve(haras_id));

drop trigger if exists evento_animais_definir_haras on public.evento_animais;
create trigger evento_animais_definir_haras before insert on public.evento_animais
  for each row execute function public.definir_haras_id();

revoke insert, update, delete on public.evento_animais from anon;

/*
  Quanto custou cada evento, e em quê.

  "Quanto gastei no evento e [em] alimentação" — as duas perguntas dele numa
  resposta só: o total por evento e a quebra por categoria.
*/
create or replace function public.custo_por_evento(
  p_desde date default null,
  p_ate date default null
)
returns table (
  evento_id uuid,
  titulo text,
  tipo text,
  data_evento date,
  animais bigint,
  total numeric,
  por_categoria json
)
language sql stable security definer
set search_path = public
as $$
  select
    e.id, e.titulo, e.tipo, e.data_evento,
    (select count(*) from public.evento_animais ea where ea.evento_id = e.id)::bigint,
    coalesce(sum(d.valor), 0),
    coalesce(
      (select json_agg(json_build_object('categoria', x.categoria, 'total', x.soma)
                       order by x.soma desc)
         from (select d2.categoria, sum(d2.valor) as soma
                 from public.despesas d2
                where d2.evento_id = e.id and d2.excluido_em is null
                group by d2.categoria) x),
      '[]'::json)
  from public.eventos e
  left join public.despesas d on d.evento_id = e.id and d.excluido_em is null
  where e.haras_id = public.meu_haras_id()
    and e.excluido_em is null
    and public.ve_financeiro()
    and (p_desde is null or e.data_evento >= p_desde)
    and (p_ate is null or e.data_evento <= p_ate)
  group by e.id, e.titulo, e.tipo, e.data_evento
  -- Evento sem despesa nenhuma não é centro de custo; é só agenda.
  having coalesce(sum(d.valor), 0) > 0
  order by coalesce(sum(d.valor), 0) desc
$$;

revoke execute on function public.custo_por_evento(date, date) from public, anon;
grant execute on function public.custo_por_evento(date, date) to authenticated;

commit;
