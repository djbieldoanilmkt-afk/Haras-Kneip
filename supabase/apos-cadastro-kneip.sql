-- ============================================================================
-- RODE UMA UNICA VEZ, DEPOIS de criar sua conta pelo app (tela Criar conta).
-- Vincula o SEU usuario ao Haras Kneip (tenant 1), em vez de criar um haras
-- novo no onboarding. Troque o e-mail abaixo pelo que voce usou no cadastro.
-- ============================================================================

insert into public.membros (haras_id, user_id, papel)
select '00000000-0000-0000-0000-000000000001', u.id, 'dono'
from auth.users u
where u.email = 'TROQUE-PELO-SEU-EMAIL@exemplo.com'
on conflict do nothing;

-- Confira: deve devolver uma linha ligando seu usuario ao Haras Kneip.
select h.nome, u.email, m.papel
from public.membros m
join public.haras h on h.id = m.haras_id
join auth.users u on u.id = m.user_id;
