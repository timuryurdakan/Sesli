-- Stage 10 sonrası güvenlik denetimi (Ajan 12 Yüksek, Ajan 11 Yüksek) —
-- depolama kotası kontrolü iki ayrı sorunluydu:
--   (a) TOCTOU yarış durumu: `SELECT SUM(size_bytes)` ile kontrol edilip çok
--       sonra (FFmpeg normalizasyonu bittikten sonra) `INSERT` yapılıyordu;
--       aynı kullanıcının eşzamanlı yüklemeleri kotayı birlikte aşabiliyordu.
--   (b) Kontrol, normalize öncesi (genelde sıkıştırılmış) boyutla yapılıyor
--       ama gerçek `size_bytes` normalize edilmiş WAV'ın (çok daha büyük)
--       boyutuydu — kota sistematik olarak olduğundan düşük hesaplanıyordu.
--
-- Bu fonksiyon, kontrolü ve INSERT'i tek bir Postgres fonksiyonu/transaction'ı
-- içinde, kullanıcı bazlı bir advisory lock ile serileştirerek atomik hale
-- getirir. apps/api artık gerçek (normalize edilmiş) `size_bytes` değerini
-- FFmpeg'ten sonra, bu fonksiyon üzerinden gönderir (bkz.
-- apps/api/src/uploads/tus-upload.middleware.ts).

create or replace function public.insert_track_if_within_quota(
  p_user_id uuid,
  p_title text,
  p_storage_path text,
  p_duration_seconds numeric,
  p_size_bytes bigint,
  p_quota_bytes bigint
) returns public.tracks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_usage bigint;
  v_track public.tracks;
begin
  -- Kullanıcı bazlı advisory lock: aynı kullanıcının eşzamanlı çağrıları
  -- serileşir (fonksiyon/transaction sonunda otomatik bırakılır), farklı
  -- kullanıcılar birbirini bloklamaz.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(size_bytes), 0) into v_current_usage
  from public.tracks
  where user_id = p_user_id;

  if v_current_usage + p_size_bytes > p_quota_bytes then
    raise exception 'STORAGE_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;

  insert into public.tracks (user_id, title, storage_path, duration_seconds, size_bytes)
  values (p_user_id, p_title, p_storage_path, p_duration_seconds, p_size_bytes)
  returning * into v_track;

  return v_track;
end;
$$;

-- Yalnızca service-role (apps/api) çağırabilir; diğer rollerden execute
-- yetkisi kasıtlı olarak alınır (tracks tablosunun kendisi gibi, istemci
-- doğrudan insert edemez).
revoke execute on function public.insert_track_if_within_quota(uuid, text, text, numeric, bigint, bigint) from public, anon, authenticated;
