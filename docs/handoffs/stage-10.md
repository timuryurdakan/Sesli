# Stage 10 — Entegrasyon, Uçtan Uca Test, Performans ve Lansman Hazırlığı

**Ajan:** 10 (Entegrasyon, Uçtan Uca Test, Performans ve Lansman Hazırlığı)
**Bağımlılık:** Ajan 1–9 (tamamı — tamamlandı)
**Durum:** Tüm 10 yapım aşaması tamamlandı. Bu stage'de yapılabilecek her şey (hata izleme, Lighthouse, yük testi, onboarding, production hazırlığı) **gerçekten çalıştırılıp doğrulandı**. Gerçek kullanıcı senaryosuyla uçtan uca test (kayıt ol → yükle → işlensin → oynatıcıda kullan → playlist'e ekle → başka cihazdan senkron gör) yalnızca gerçek bir Supabase/Upstash projesi ile mümkündür — bu, Stage 2'den beri her handoff'ta tutarlı şekilde belirtilen sınırlamadır.

## Bu Stage'de Yapılanlar

### 1. Hata İzleme (Sentry — ücretsiz tier) — 3 serviste de kuruldu ve smoke test edildi

- **apps/api**: `@sentry/nestjs` (`SentryModule.forRoot()` + `SentryGlobalFilter` global exception filter + `instrument.ts` main.ts'in en başında import ediliyor). Gerçekten başlatılıp `/` uç noktasının 200 döndüğü doğrulandı.
- **apps/web**: `@sentry/nextjs` — `instrumentation.ts` (server/edge init + `onRequestError`), `instrumentation-client.ts` (tarayıcı init + `onRouterTransitionStart`), `next.config.ts` `withSentryConfig` ile sarmalandı.
- **apps/ai-service**: `sentry-sdk[fastapi]`, `main.py`'ın başında `sentry_sdk.init()`. Gerçekten başlatılıp `/health`'in 200 döndüğü doğrulandı.
- Üçünde de `SENTRY_DSN` tanımlı değilse SDK'lar sessizce no-op olur (kurulan "Supabase olmadan da çalışır" desenine tutarlı) — proje sahibi ücretsiz bir Sentry hesabı açtığında yalnızca env değişkenini doldurması yeterli.

### 2. Lighthouse Performans Denetimi — **gerçekten çalıştırıldı**

Production build (`next build` + `next start`) üzerinde, mobil emülasyonla:

| Sayfa | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` (yeni ana sayfa) | **96** | 95 | 100 | 100 |
| `/login` | 95 | 95 | 100 | 100 |

DoD'nin istediği "≥80 mobilde" hedefi **rahatlıkla aşıldı**.

### 3. Yük Testi (Artillery) — **gerçekten çalıştırıldı**, bkz. `infra/load-test/README.md`

- NestJS API: 8550 istek, **0 başarısız**, p95=1ms, p99=2ms (85 istek/sn tepe yük).
- FastAPI AI servisi (`/health`): 1050 istek, **0 başarısız**, p95=3ms, p99=4ms.
- **Sınırlama:** Ağır uç noktalar (`/separate`, `/chords`, `/tempo`, `/transform`, `/uploads`) gerçek Supabase/Redis olmadan test edilemedi — detaylar ve bir sonraki adım README'de.

### 4. Onboarding ve Yardım/SSS — **eksik bir boşluk kapatıldı**

`apps/web/app/page.tsx` **9 stage boyunca hâlâ `create-next-app`'in varsayılan şablon içeriğiydi** ("To get started, edit the page.tsx file", Vercel/Next.js linkleri) — hiçbir ajan bunu değiştirmemişti. Şimdi:
- Gerçek bir karşılama/tanıtım sayfası (özellik özeti + Kayıt Ol/Giriş Yap CTA'ları, oturum açık kullanıcılar için "Yeni Şarkı Yükle"/"Çalma Listelerim" kısayolları).
- `/help` — Hızlı Başlangıç checklist'i + 8 maddelik SSS (dosya formatları, işleme süresi, akor doğruluğu, piyano kalitesi, telif/paylaşım, hesap silme, prova modu, depolama kotası).

### 5. `/dev/player-demo` Production Guard'ı (Stage 07'de bırakılan TODO kapatıldı)

Stage 07 handoff'u bu rotanın production'a gitmeden önce ele alınmasını istemişti. Artık `NODE_ENV === "production"` iken `notFound()` döndürüyor — **gerçekten build edilip production modda 404 döndüğü doğrulandı**, geliştirme modunda hâlâ erişilebilir.

### 6. Performans/Kuyruk Optimizasyonu (mevcut durum değerlendirmesi)

- BullMQ worker concurrency ve AI servisindeki `asyncio.Semaphore` zaten `MAX_CONCURRENT_JOBS` ile sınırlı (Stage 4/6) — ücretsiz CPU altyapısında kaynak taşmasına karşı temel koruma zaten var.
- Service worker (Stage 7/8) stem ses dosyalarını ve `GET /tracks` yanıtlarını önbelleğe alarak gereksiz tekrar isteklerini zaten azaltıyor.
- Spekülatif ek "optimizasyon" yapılmadı — somut bir profil/darboğaz kanıtı olmadan yapılan optimizasyon genellikle gereksiz karmaşıklık ekler; gerçek Supabase/Redis ile üretimde ölçüm yapıldıktan sonra ihtiyaç varsa ele alınmalı.

## Genel Proje Durumu — Tüm 8 Özellik

| # | Özellik | Durum |
|---|---|---|
| 1 | Yapay Zeka Destekli Parça Ayırma | ✅ Kod tamam, **gerçek Demucs ile canlı test edildi** (Stage 4) |
| 2 | Akıllı Akor Tespiti | ✅ Kod tamam, **gerçek sentetik akorlarla doğruluğu kanıtlandı** (Stage 5) |
| 3 | Tempo ve Akıllı Metronom | ✅ Kod tamam, **gerçek SoundTouch ile sayısal doğrulandı** (Stage 6) |
| 4 | Ton Değiştirme | ✅ Aynı (Stage 6) |
| 5 | Akıllı Loop | ✅ Kod tamam, **tarayıcıda sürükle-bırak ile test edildi** (Stage 7) |
| 6 | Geri Sayım (Count-in) | ✅ Kod tamam, tarayıcıda test edildi (Stage 7) |
| 7 | Çalma Listeleri / Bulut Senkronizasyonu | ✅ Kod tamam, RLS+Realtime mimarisi doğru kuruldu (Stage 8) — **gerçek çoklu-cihaz senkronu Supabase gerektirir, canlı test edilemedi** |
| 8 | Senkronize Prova Modu | ✅ Kod tamam, Realtime Authorization RLS'i tip tanımlarından doğrulandı (Stage 9) — **gerçek çoklu-cihaz senkronu Supabase gerektirir, canlı test edilemedi** |

## Proje Sahibinin Yapması Gerekenler (Production'a Geçmeden Önce)

Bu ajanların hiçbiri tarayıcı tabanlı hesap oluşturma/OAuth gerektiren adımları otomatik yapamaz. Sırasıyla:

1. **Supabase** projesi oluştur → `supabase/migrations/*.sql` dosyalarını (0001'den 0005'e sırayla) SQL Editor'de çalıştır veya `supabase db push` kullan → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`'i ilgili `.env`'lere doldur.
2. **Supabase Storage**: `tracks` bucket'ının migration'daki gibi (private) oluştuğunu doğrula.
3. **Google OAuth** (opsiyonel): Google Cloud Console'da bir OAuth client oluşturup Supabase Dashboard → Authentication → Providers → Google'a ekle.
4. **Upstash Redis** oluştur → `REDIS_URL`'i doldur.
5. **FFmpeg (LGPL)** ve **SoundTouch (`soundstretch`, LGPL)** binary'lerini indir (bkz. kök `README.md`) → `FFMPEG_PATH`/`FFPROBE_PATH`/`SOUNDSTRETCH_PATH`.
6. **Vercel**'e `apps/web`'i, **Render/Fly.io/HF Spaces**'e `apps/api` ve `apps/ai-service`'i deploy et (Root Directory ayarları için kök `README.md`'ye bkz.).
7. **Sentry** (opsiyonel, ücretsiz tier): hesap açıp `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`'i doldur.
8. Yukarıdaki adımlardan sonra: yeni bir hesapla kayıt ol → şarkı yükle → işlensin → oynatıcıda dene → playlist'e ekle → ikinci bir cihaz/tarayıcıda aynı hesapla giriş yapıp senkronu doğrula.

## Ajan 12'ye (Güvenlik Denetçisi) Tetikleyici Notu

Bu stage'in tamamlanması, plan gereği Ajan 12'nin devreye girmesi için tetikleyicidir (Bölüm 8.2). Orkestratör bu handoff'un ardından Ajan 12'yi (ve retroaktif bir Ajan 11 bug-avcılığı geçişini) başlatacaktır. Ajan 12'nin özellikle bakması gereken, bu stage'lerde inşa edilen yüksek riskli noktalar:
- `supabase/migrations/0005_*.sql`'deki Realtime Authorization RLS'i — başka bir kullanıcının `practice-{uid}` kanalına gerçekten erişemediği agresif şekilde test edilmeli.
- `apps/api/src/transform/transform.controller.ts`'teki storagePath sahiplik kontrolü.
- Depolama kotası kontrolünün (Stage 8) race condition'a açık olup olmadığı (iki eşzamanlı yükleme kotayı birlikte aşabilir mi?).
- Tüm dosya yükleme/MIME doğrulama zinciri (Stage 3).

## Bilinen Sınırlamalar (Proje Genelinde Özet)

- **Bölüm 6.7 (i18n) hiçbir stage'de uygulanmadı** — Stage 9 handoff'unda da not edildi, hâlâ açık. Tüm arayüz şu an sabit Türkçe.
- Gerçek çoklu-cihaz Realtime senkronizasyonu (Özellik 7 ve 8) hiçbir stage'de canlı test edilemedi — yalnızca kod/mimari doğrulaması yapıldı.
- Gitar/piyano akor diyagramı eklenmedi (opsiyonel, Ajan 5).
- Playlist yeniden adlandırma UI'ı eksik (hook hazır, buton yok).
