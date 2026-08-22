-- Stage 03 (Ajan 3) — "tracks" storage bucket'ı ve erişim politikaları.
-- Dosyalar `raw/{userId}/{uploadId}.wav` düzeninde saklanır (bkz.
-- apps/api/src/uploads/tus-upload.middleware.ts).

insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', false)
on conflict (id) do nothing;

-- Şu an tüm yazma/okuma işlemleri apps/api'nin service-role client'ı üzerinden
-- yapılıyor (RLS'i bypass eder). Yine de istemcinin ileride (ör. imzalı URL
-- olmadan) doğrudan Storage'a erişmeye çalışması ihtimaline karşı, her
-- kullanıcının yalnızca kendi `raw/{auth.uid()}/...` klasörünü
-- görebildiğini/yazabildiğini garanti eden bir taban RLS politikası:

create policy "tracks_bucket_select_own_folder"
  on storage.objects for select
  using (
    bucket_id = 'tracks'
    and (storage.foldername(name))[1] = 'raw'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "tracks_bucket_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'tracks'
    and (storage.foldername(name))[1] = 'raw'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
