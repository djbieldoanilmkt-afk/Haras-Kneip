-- 040 — Conserta o cadastro de macho, que eu quebrei na 033.
--
-- A 033 criou `animais_status_combina_com_sexo`, que recusa "macho vazia" —
-- correto, porque 'Vazia' quer dizer "não está prenha".
--
-- Só que a COLUNA tem `default 'Vazia'`. Quem insere um macho sem informar o
-- status recebe o padrão e bate na restrição. E `agente_cadastrar_animal` não
-- informa status nenhum: cadastrar um garanhão pelo WhatsApp passou a falhar.
--
-- Medido, não suposto:
--   Macho -> QUEBRADO: violates check constraint
--   Fêmea -> FUNCIONA
--
-- Ficou assim desde ontem. Só não apareceu porque ninguém cadastrou macho
-- nesse intervalo — o que é sorte, não margem de segurança.
--
-- A CAUSA é o padrão, não a restrição: um valor exclusivo de fêmea não pode
-- ser o padrão de uma coluna que serve aos dois sexos. Nulo é a resposta
-- honesta para "status reprodutivo ainda não informado".

begin;

alter table public.animais alter column status_reprodutivo drop default;

/*
  O formulário continua mandando 'Vazia' para égua, e agora o agente pode
  cadastrar garanhão sem dizer nada sobre reprodução.

  Não preencho macho com 'Garanhão Ativo' automaticamente: isso é uma
  afirmação sobre o animal — se ele cobre ou não — e o sistema não sabe.
*/
comment on column public.animais.status_reprodutivo is
  'Nulo quando nao informado. Valores de femea e de macho sao distintos: ver animais_status_combina_com_sexo.';

commit;
