-- ============================================================================
-- FUNDACAO SAAS - PARTE 3 DE 3: STORAGE
-- Rode depois do 002_rls.sql.
-- Buckets para logo do haras e fotos dos animais. Leitura publica (as URLs
-- aparecem na vitrine); escrita so na pasta do proprio haras.
-- ============================================================================

begin;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('fotos-animais', 'fotos-animais', true)
on conflict (id) do nothing;

-- Escrita restrita a pasta {haras_id}/... do proprio usuario.
create policy tenant_storage_ins on storage.objects for insert to authenticated
  with check (
    bucket_id in ('logos', 'fotos-animais')
    and (storage.foldername(name))[1] = public.meu_haras_id()::text
  );

create policy tenant_storage_upd on storage.objects for update to authenticated
  using (
    bucket_id in ('logos', 'fotos-animais')
    and (storage.foldername(name))[1] = public.meu_haras_id()::text
  );

create policy tenant_storage_del on storage.objects for delete to authenticated
  using (
    bucket_id in ('logos', 'fotos-animais')
    and (storage.foldername(name))[1] = public.meu_haras_id()::text
  );

create policy tenant_storage_sel on storage.objects for select to authenticated
  using (
    bucket_id in ('logos', 'fotos-animais')
    and (storage.foldername(name))[1] = public.meu_haras_id()::text
  );

commit;
