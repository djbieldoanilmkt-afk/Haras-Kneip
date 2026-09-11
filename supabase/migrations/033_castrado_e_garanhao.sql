-- 033 — Castrado, garanhão ativo, e o fim do "macho vazia".
--
-- DOIS PROBLEMAS QUE SE ENCONTRAM AQUI
--
-- 1. Seu Hélio nomeou as categorias do haras: "fêmeas, potras, éguas adultas,
--    os garanhões, e aqui tem também o castrado". CASTRADO não existia em
--    lugar nenhum do sistema.
--
-- 2. A tela oferecia 'Garanhão Ativo' e o banco RECUSAVA — medido: inserir um
--    macho com esse status dava violação de restrição. Quem escolhesse a opção
--    do menu levava erro. É a terceira vez neste projeto que a lista da tela e
--    a do banco divergem (antes: 'Vacina' x 'Vacinação', e as categorias de
--    despesa). Por isso agora vem com uma trava que impede a volta.
--
-- 3. Todo macho estava como 'Vazia' — que quer dizer "não está prenha". Isso
--    não é só feio: aparece na VITRINE PÚBLICA, escrito "Diamante Negro ♂
--    VAZIA", para o comprador ler.
--
-- SOBRE MEXER NO CADASTRO DELE
--
-- Eu vinha evitando alterar os registros do haras. Faço aqui porque "macho não
-- está prenha" não carrega informação nenhuma — não há o que preservar —, e
-- porque o dado está sendo mostrado a comprador. Quem quiser marcar o garanhão
-- como ativo agora tem a opção certa no menu.

begin;

alter table public.animais drop constraint if exists animais_status_reprodutivo_check;

-- Limpa ANTES de travar: com a restrição nova, uma linha inválida faria a
-- migração inteira parar e o banco ficaria sem trava nenhuma.
update public.animais
   set status_reprodutivo = null
 where sexo = 'Macho'
   and status_reprodutivo in ('Vazia', 'Prenha', 'Lactante', 'Em Cobertura');

alter table public.animais add constraint animais_status_reprodutivo_check
  check (
    status_reprodutivo is null
    or status_reprodutivo in (
      'Vazia', 'Prenha', 'Lactante', 'Em Cobertura',  -- só fêmea
      'Potro/Potra',                                   -- os dois
      'Garanhão Ativo', 'Castrado'                     -- só macho
    )
  );

/*
  Status de fêmea não cola em macho, e vice-versa.

  Sem isto, "Diamante Negro, Vazia" volta na primeira importação ou no primeiro
  formulário desatento — e volta calado, porque o banco aceitava qualquer um
  dos valores para qualquer sexo.
*/
alter table public.animais drop constraint if exists animais_status_combina_com_sexo;
alter table public.animais add constraint animais_status_combina_com_sexo
  check (
    status_reprodutivo is null
    or status_reprodutivo = 'Potro/Potra'
    or (sexo = 'Fêmea' and status_reprodutivo in ('Vazia', 'Prenha', 'Lactante', 'Em Cobertura'))
    or (sexo = 'Macho' and status_reprodutivo in ('Garanhão Ativo', 'Castrado'))
  );

/*
  A vitrine também não mostra status reprodutivo de macho.

  A restrição acima impede novos registros errados, mas a decisão de exibição é
  outra: mesmo um 'Garanhão Ativo' correto não é informação de vitrine no mesmo
  lugar onde a égua mostra "Prenha". Quem compra quer saber a categoria.
*/
create or replace function public.categoria_do_animal(
  p_sexo text, p_status text, p_nascimento date
)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_status = 'Castrado' then 'Castrado'
    when p_status = 'Potro/Potra' or (p_nascimento is not null
         and p_nascimento > current_date - interval '3 years')
      then case when p_sexo = 'Fêmea' then 'Potra' else 'Potro' end
    when p_sexo = 'Fêmea' then 'Égua'
    else 'Garanhão'
  end
$$;

grant execute on function public.categoria_do_animal(text, text, date)
  to anon, authenticated, service_role;

commit;
