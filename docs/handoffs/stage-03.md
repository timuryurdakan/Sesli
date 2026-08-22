# Stage 03 — Dosya Yükleme ve İş Kuyruğu Altyapısı

**Ajan:** 3 (Dosya Yükleme ve İş Kuyruğu Altyapısı)
**Bağımlılık:** Ajan 1, Ajan 2 (tamamlandı)
**Durum:** Kod tamamlandı, build/lint/test yeşil, **ve uçtan uca gerçek bir smoke testle doğrulandı** (aşağıya bkz.) — bu, Supabase/Redis bağlanana kadar ulaşılabilecek en yüksek doğrulama seviyesidir.

## Ne İnşa Edildi

### apps/api/src/uploads
- `tus-upload.middleware.ts` — `@tus/server` + `@tus/file-store` ile chunked/resumable dosya yükleme (Özellik 1 altyapısı). Akış:
  1. `onUploadCreate`: `Authorization: Bearer <supabase_jwt>` doğrulanır (`SUPABASE_JWT_SECRET`, HS256); doğrulanan `userId` upload metadata'sına (istemcinin gönderdiği değer görmezden gelinerek) sunucu tarafından yazılır — spoofing'e karşı.
  2. `onUploadFinish`: tamamlanan dosyanın gerçek MIME türü `file-type` ile magic-byte sniffing kullanılarak doğrulanır (yalnızca uzantı/Content-Type'a güvenilmez — Bölüm 6.6/9.4/12). Desteklenmeyen tür → `415`.
  3. FFmpeg (`FfmpegService`) ile standart WAV/PCM'e normalize edilir; süre (`ffprobe`) okunur.
  4. Normalize edilmiş dosya Supabase Storage'a (`tracks` bucket, `raw/{userId}/{uploadId}.wav`) yüklenir.
  5. `tracks` ve `jobs` (status: `pending`) satırları service-role client ile oluşturulur.
  6. BullMQ'ya `stem-separation` işi eklenir (Ajan 4 için).
  7. Geçici dosyalar (`finally` bloğunda) her koşulda temizlenir.
- `upload-validation.ts` — saf/test edilebilir fonksiyonlar: `isAllowedMimeType`, `getMaxUploadBytes` (env `UPLOAD_MAX_BYTES`, varsayılan 500 MB).
- `uploads.module.ts` — middleware'i yalnızca `/uploads*` path'ine bağlar (`NestModule.configure`).

### apps/api/src/ffmpeg
- `ffmpeg.service.ts` — `fluent-ffmpeg` sarmalayıcısı; binary yolu **bundle edilmez**, `FFMPEG_PATH`/`FFPROBE_PATH` env değişkenleriyle verilir (bkz. "Ãnemli Lisans Notu").

### apps/api/src/queue
- `stem-separation.queue.ts` — BullMQ `Queue` (ioredis, `REDIS_URL`, lazy init).
- `stem-separation.worker.ts` — **PLACEHOLDER worker**: `pending → processing → (3sn bekleme) → done` geçişini simüle eder, `jobs` tablosunu günceller. **Ajan 4 bu worker'ın içini gerçek Demucs/FastAPI çağrısıyla değiştirecek** (queue/worker altyapısının kendisi değişmeyecek).

### apps/api/src/jobs
- `jobs.controller.ts` — `GET /jobs/:id` (guard korumalı): polling fallback'i; asıl gerçek zamanlı güncelleme istemcinin doğrudan Supabase Realtime ile `jobs` tablosuna abone olmasıyla yapılır. Service-role client RLS'i bypass ettiği için sahiplik kontrolü (`user_id` eşleşmesi) elle yapılır.

### supabase/migrations
- `0002_tracks_and_jobs.sql` — `tracks` (RLS: select/delete own), `jobs` (RLS: select own; insert/update yalnızca service-role) tabloları + `job_status` enum + `jobs` için Realtime publication + `updated_at` trigger'ı.
- `0003_storage.sql` — `tracks` storage bucket'ı (private) + `storage.objects` üzerinde "yalnızca kendi `raw/{auth.uid()}/...` klasörü" RLS politikaları (şu an tüm yazma service-role ile yapılıyor, bu politikalar ileride doğrudan istemci erişimine karşı bir güvenlik tabanı).

### packages/shared-types
- `Track` tipi eklendi.

## Ãnemli Lisans Notu: FFmpeg (Bölüm 9.2)

`ffmpeg-static` npm paketinin Windows binary'si **GPL derlemesi** olduğu tespit edildi (`--enable-gpl`, `libx264`/`libx265`/`librubberband` dahil) — bu, Bölüm 9.2'nin açıkça uyardığı riskin ta kendisi. Bu paket **kaldırıldı**. Bunun yerine:
- `FfmpegService`, binary yolunu yalnızca `FFMPEG_PATH`/`FFPROBE_PATH` env değişkenlerinden okur, hiçbir binary bundle etmez.
- Doğrulanmış LGPL kaynağı: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) `*-lgpl*` release varyantı (`--disable-libx264 --disable-libx265 --disable-librubberband` vb. — bizzat `-version` çıktısı incelenerek doğrulandı).
- **Production deploy'da da bu LGPL binary'nin temin edilmesi gerekiyor** (Docker image'a indirilerek veya build script'iyle) — bir sonraki entegrasyon/deploy ajanı (Ajan 10) bunu deployment adımına eklemeli.

## Uçtan Uca Smoke Test (bu ajan tarafından gerçekten çalıştırıldı)

Supabase/Redis olmadan, yalnızca `SUPABASE_JWT_SECRET` ve gerçek bir LGPL FFmpeg binary'siyle:
1. `POST /uploads` (auth header yok) → **401** ✅
2. `POST /uploads` (geçerli JWT) → **201 Created** + `Location` header ✅
3. `PATCH <location>` gerçek bir MP3 dosyasıyla (ffmpeg ile üretildi) → dosya doğru tanındı (`audio/mpeg` sniffing geçti), FFmpeg normalizasyonu başarıyla çalıştı, süre okundu → beklendiği gibi yalnızca Supabase Storage adımında **500 "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured"** ile durdu (bu, gerçek Supabase projesi olmadığı için beklenen ve doğru davranış).
4. Geçici dosyaların (`finally` bloğu) hata durumunda dahi temizlendiği doğrulandı.

Bu, tus akışının, JWT doğrulamanın, MIME sniffing'in ve FFmpeg entegrasyonunun **gerçekten çalıştığını** kanıtlıyor — yalnızca dış bulut bağımlılığı (Supabase) sınırında durduruldu.

## Ortaya Çıkan API Uç Noktaları

- `POST/PATCH/HEAD/DELETE /uploads[/:id]` — tus protokolü (resumable upload).
- `GET /jobs/:id` — iş durumu sorgulama (guard korumalı).

## Gerekli Ortam Değişkenleri (yeni eklenenler, apps/api/.env.example)

- `UPLOAD_MAX_BYTES` (varsayılan 500 MB), `UPLOAD_TMP_DIR`
- `FFMPEG_PATH`, `FFPROBE_PATH` (LGPL binary yolu — yukarıdaki nota bkz.)
- `REDIS_URL` zaten Stage 01'de vardı, bu stage'de fiilen kullanılmaya başlandı.

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Ajan 4**, `stem-separation.worker.ts` içindeki placeholder işlemi gerçek Demucs çağrısıyla (muhtemelen `AI_SERVICE_URL`'e HTTP isteği) değiştirmeli; queue/job altyapısının kendisi değişmemeli.
- Worker şu an API ile **aynı Node process'i içinde** çalışıyor (basitlik için). Üretimde ayrı bir process/servise taşımak isteğe bağlı bir ölçeklendirme kararı.
- tus'un kendi `.json` metadata sidecar dosyaları (yarım kalan/süresi dolmuş yüklemeler için) `Server.cleanUpExpiredUploads()` ile periyodik temizlenmeli — bu stage'de bir cron/zamanlayıcı eklenmedi, ileride (Ajan 10 veya bir bakım görevi) eklenebilir.
- `@tus/server` v2.4.4'ün TypeScript tipleri (`onUploadCreate`/`onUploadFinish` hook'ları) `srvx`'in web-standard `Request`'ini referans alıyor ama runtime'da gerçekte Node'un `http.IncomingMessage`'ı geçiliyor gibi görünüyor (`Server.handle()` imzasına bakılırsa) — bu, kütüphanenin tip tanımlarındaki bir tutarsızlık olabilir. Kodda buna karşı savunmacı bir `readHeader()` yardımcı fonksiyonu yazıldı (hem Node hem Fetch-style header okuma). Smoke test bunun pratikte doğru çalıştığını kanıtladı.
- Gerçek Supabase Storage/Postgres/Redis bağlantısı olmadan bu ajan, adım 3'ten (Storage upload) sonrasını canlı doğrulayamadı — proje sahibi gerçek Supabase/Upstash bağlandıktan sonra tam akışı (`tracks`/`jobs` satırlarının oluştuğunu, dosyanın Storage'da göründüğünü) manuel doğrulamalı.
- `video/quicktime` (.mov) izin verilen MIME listesine eklendi ama FFmpeg normalizasyon path'i yalnızca ses çıkışı üretiyor (`.noVideo()`); video dosyalarından ses ayıklamak bu stage'in kapsamındaydı, davranış doğru (video girişi kabul edilip sesi çıkarılıyor).
