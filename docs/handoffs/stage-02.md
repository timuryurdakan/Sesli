# Stage 02 — Kimlik Doğrulama ve Kullanıcı Yönetimi

**Ajan:** 2 (Kimlik Doğrulama ve Kullanıcı Yönetimi)
**Bağımlılık:** Ajan 1 (tamamlandı)
**Durum:** Kod tamamlandı ve yerelde build/lint/test doğrulandı. **Uçtan uca canlı test (gerçek kayıt/giriş, RLS kanıtı) gerçek bir Supabase projesi gerektirir ve bu ajan tarafından yapılamadı** — bkz. "Bilinen Sınırlamalar".

## Ne İnşa Edildi

### apps/web
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` — `@supabase/ssr` ile browser/server/proxy client kurulumu.
- `proxy.ts` (Next.js 16'da "middleware" konvansiyonunun yeni adı) — `/account`, `/projects`, `/practice` altındaki route'ları oturum yoksa `/login`'e yönlendirir; her istekte Supabase oturumunu tazeler.
- `app/login/page.tsx` + `actions.ts` — e-posta/şifre girişi + Google OAuth (`signInWithOAuth`).
- `app/signup/page.tsx` + `actions.ts` + `check-email/page.tsx` — kayıt akışı, e-posta doğrulama beklentisi.
- `app/forgot-password/page.tsx` + `actions.ts` + `check-email/page.tsx` — şifre sıfırlama isteği.
- `app/reset-password/page.tsx` + `actions.ts` — yeni şifre belirleme (sıfırlama linkinden sonra).
- `app/auth/callback/route.ts` — OAuth/e-posta doğrulama code exchange handler.
- `app/account/page.tsx` + `actions.ts` — profil düzenleme, çıkış yapma, **hesap silme** (KVKK/GDPR "unutulma hakkı" — NestJS API'deki `DELETE /users/me`'yi çağırır).
- `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx` — Bölüm 6.6'daki telif/kullanım maddelerini içeren taslak metinler (hukuki tavsiye değildir, notu sayfada mevcut).

### apps/api
- `src/auth/supabase-auth.guard.ts` — `SUPABASE_JWT_SECRET` ile Supabase JWT'sini (HS256) doğrulayan `CanActivate` guard'ı; `request.user = { id, email }` set eder.
- `src/auth/current-user.decorator.ts` — `@CurrentUser()` param decorator.
- `src/supabase/supabase.service.ts` + `supabase.module.ts` (`@Global()`) — service-role Supabase admin client'ı **lazy** olarak kurar (env eksikse yalnızca kullanıldığında hata verir, uygulama açılışını engellemez).
- `src/users/users.controller.ts` — `DELETE /users/me` (guard korumalı): `supabase.admin.auth.admin.deleteUser(user.id)` çağırır; `profiles` satırı `ON DELETE CASCADE` ile otomatik silinir.
- `src/main.ts` — CORS `WEB_APP_ORIGIN`'e göre açıldı, varsayılan port 3001 yapıldı.
- `src/auth/supabase-auth.guard.spec.ts` — guard için birim test (geçerli/geçersiz/eksik token senaryoları).

### supabase/migrations/0001_profiles.sql
- `public.profiles` tablosu (`id`, `email`, `full_name`, `instrument`, `created_at`).
- RLS **aktif**: `profiles_select_own` ve `profiles_update_own` politikaları — `auth.uid() = id` koşuluyla her kullanıcı yalnızca kendi satırına erişebilir.
- `handle_new_user()` trigger fonksiyonu (`SECURITY DEFINER`) + `on_auth_user_created` trigger'ı: `auth.users`'a yeni kayıt düşünce otomatik `profiles` satırı oluşturur (`raw_user_meta_data->>'full_name'` kullanılarak).

## Ortaya Çıkan API Uç Noktaları / Şemalar

- `DELETE /users/me` (apps/api, `Authorization: Bearer <supabase_access_token>` gerekli) → `204 No Content`.
- `public.profiles(id uuid PK, email text, full_name text, instrument text, created_at timestamptz)`.

## Gerekli Ortam Değişkenleri (yeni eklenenler)

- `apps/web/.env.example`: `NEXT_PUBLIC_SITE_URL` eklendi (OAuth/e-posta callback redirect'i için).
- `apps/api/.env.example`: zaten Stage 01'de vardı (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) — bu stage'de fiilen kullanılmaya başlandı.

## Yerelde Nasıl Çalıştırılır / Test Edilir

```bash
pnpm build && pnpm lint && pnpm test   # kök seviyede — hepsi yeşil (Supabase env'i olmadan da build/lint/test geçer)
```

**Gerçek Supabase projesi bağlandıktan sonra manuel uçtan uca test adımları** (proje sahibi tarafından yapılmalı):
1. `supabase/migrations/0001_profiles.sql`'i Supabase SQL Editor'e yapıştırıp çalıştır (veya `supabase db push`).
2. `apps/web/.env`, `apps/api/.env` dosyalarını gerçek Supabase URL/anon key/service role key/JWT secret ile doldur.
3. `pnpm dev:web` + `pnpm dev:api` çalıştır, `/signup` üzerinden yeni hesap oluştur, doğrulama e-postasındaki linke tıkla, `/login`'den giriş yap.
4. Supabase dashboard → Table Editor → `profiles`: yeni kullanıcı için otomatik satır oluştuğunu doğrula.
5. İki farklı kullanıcıyla giriş yapıp, ikinci kullanıcının SQL Editor'den birinci kullanıcının `profiles` satırını göremediğini (RLS) doğrula.
6. `/account`'tan "Hesabı Sil" ile hesabı sil, `auth.users` ve `profiles`'ten satırın kalktığını doğrula.
7. Google OAuth'u test etmek için Supabase Dashboard → Authentication → Providers → Google'da bir OAuth client ID/secret girilmesi gerekir (bu da proje sahibinin Google Cloud Console'da ücretsiz bir OAuth client oluşturmasını gerektirir).

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Bu ajan, canlı bir Supabase projesi olmadan çalıştığı için yukarıdaki 7 adımı bizzat çalıştırıp doğrulayamadı.** Kod, Supabase'in resmi `@supabase/ssr` + Next.js App Router entegrasyon deseni ve resmi RLS pattern'lerine (auth.uid() = id) göre yazıldı, ancak canlı doğrulama olmadan "DoD tam karşılandı" denemez. Ortam bu ajanda Docker da içermediği için yerel `supabase start` ile bile test edilemedi.
- Google OAuth, Supabase tarafında bir provider konfigürasyonu (Client ID/Secret) gerektirir — bu adım proje sahibinin Google Cloud Console + Supabase Dashboard'da yapması gereken, koddan bağımsız bir adımdır.
- `proxy.ts`'deki korumalı path listesi (`/account`, `/projects`, `/practice`) ileriye dönük; `/projects` ve `/practice` henüz yok, Ajan 8/7 bunları ekleyince liste zaten doğru çalışacak.
- Şifre hash'leme, oturum/JWT yönetimi tamamen Supabase Auth'a devredildi (Bölüm 8.2'deki Ajan 12 denetiminde ayrıca doğrulanmalı — Supabase bunu bcrypt ile zaten yapıyor).
- `profiles` tablosunda henüz "plan/rol alanı" (Bölüm 7 Ajan 2 gereksinimi: "ileride gerekirse") eklenmedi; şu an gereksiz görüldüğü için atlandı, ihtiyaç doğunca yeni bir migration ile eklenmeli.
