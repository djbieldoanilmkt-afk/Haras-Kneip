-- 027 — Desfaz um índice que eu criei sem precisar.
--
-- A 022 criou `membros_user_id_unico` para garantir "um haras por pessoa".
-- A garantia já existia: a 001 criou `membros_um_haras_por_usuario`, idêntico,
-- desde o começo do projeto.
--
-- COMO O ERRO ACONTECEU
--
-- Procurei em `information_schema.table_constraints`, que só lista
-- CONSTRAINTS. `create unique index` cria um ÍNDICE, e índice não aparece ali.
-- A consulta devolveu zero e eu li isso como "não há garantia nenhuma".
--
-- O que isso invalida do diagnóstico da 022: `meu_haras_id()` NÃO era ambígua.
-- Com o índice único, aquele `limit 1` só podia casar com uma linha — nunca
-- houve como oscilar entre dois haras. O `order by` que acrescentei continua,
-- por ser defesa barata, mas não estava consertando nada quebrado.
--
-- O que a 022 corrigiu de verdade, e fica: `criar_haras` tratava QUALQUER
-- unique_violation como slug repetido, então esbarrar na filiação duplicada
-- respondia "este endereço já está em uso" e a pessoa trocaria o nome do haras
-- para sempre sem nunca acertar. Esse defeito era real, e existia desde a 001.

begin;

drop index if exists public.membros_user_id_unico;

commit;
