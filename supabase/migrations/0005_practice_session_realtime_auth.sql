-- Stage 09 (Ajan 9 — Senkronize Prova Modu / Özellik 8)
--
-- Prova modu, Supabase Realtime'ın "private" Broadcast kanallarını kullanır.
-- Kanal adı `practice-{auth.uid()}` biçimindedir; bu politikalar sayesinde
-- yalnızca o kullanıcının kendi (JWT'si geçerli) cihazları kendi kanalına
-- abone olabilir/yayın yapabilir — başka bir kullanıcı kanal adını tahmin
-- etse bile RLS bunu reddeder. `realtime.messages` üzerinde RLS varsayılan
-- olarak zaten aktiftir (Supabase güvence veriyor), yalnızca politika ekliyoruz.
--
-- ÖNEMLİ: İstemci tarafında bu politikaların uygulanması için kanal
-- `{ config: { private: true } }` ile oluşturulmalı ve abone olmadan önce
-- `supabase.realtime.setAuth()` çağrılmalıdır (bkz.
-- apps/web/lib/practice/usePracticeSession.ts) — aksi halde kanal "public"
-- kabul edilir ve bu RLS politikaları hiç devreye girmez.

create policy "practice_channel_select_own"
  on "realtime"."messages"
  for select
  to authenticated
  using (
    realtime.topic() = 'practice-' || (select auth.uid())::text
  );

create policy "practice_channel_insert_own"
  on "realtime"."messages"
  for insert
  to authenticated
  with check (
    realtime.topic() = 'practice-' || (select auth.uid())::text
  );
