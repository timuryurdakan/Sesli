# Stage 08 — Çalma Listeleri, Proje Yönetimi ve Bulut Senkronizasyonu

**Ajan:** 8 (Çalma Listeleri, Proje Yönetimi ve Bulut Senkronizasyonu)
**Bağımlılık:** Ajan 2, Ajan 7 (tamamlandı)
**Durum:** Kod tamamlandı, build/lint/test yeşil, **UI'lar gerçek tarayıcıda (Playwright) hatasız render olduğu doğrulandı**; Realtime senkronizasyonun kendisi gerçek Supabase gerektirdiği için canlı test edilemedi (önceki tüm stage'lerdeki aynı sınırlama).

## Mimari Karar: Playlist CRUD'u Doğrudan Supabase'e, NestJS Proxy'si Olmadan

Önceki stage'lerin aksine (jobs/tracks/transform — hepsi service-role ile NestJS API üzerinden), **playlist CRUD'u ve okuma işlemleri doğrudan tarayıcıdaki Supabase istemcisi** (anon key + kullanıcı oturumu) üzerinden yapılıyor. Gerekçe:
- Supabase Realtime'ın `postgres_changes` özelliği, **RLS'i client'ın kendi JWT'siyle** uyguluyor — bu yüzden Realtime'a abone olmak için istemcinin doğrudan Supabase'e bağlanması gerekiyor (NestJS üzerinden bir REST proxy ile bu "bedava" gelmiyor).
- Bölüm 7 Ajan 8 DoD'si zaten "bir cihazda playlist'e parça eklendiğinde... Realtime ile göründüğü" diyor — yazma işlemi HANGİ istemciden yapılırsa yapılsın (bizim durumumuzda da doğrudan tarayıcıdan), Postgres logical replication üzerinden diğer abone istemcilere otomatik yayılıyor.
- RLS politikaları (aşağıya bkz.) zaten insert/update/delete için "yalnızca kendi playlist'in" kuralını uyguluyor, bu yüzden service-role'e gerek kalmadan güvenli.

Bu, jobs/tracks/transform'un NestJS üzerinden gitmeye devam etmesiyle **çelişmiyor** — onlarda imzalı URL üretimi, harici AI servis çağrısı gibi gerçek bir backend işi var; playlist'lerde böyle bir iş yok, saf CRUD + realtime.

## Ne İnşa Edildi

### supabase/migrations/0004_playlists.sql
- `tracks` tablosuna `artist`, `tags text[]` (arama/filtreleme için) ve `size_bytes` (depolama kotası için) kolonları eklendi.
- `playlists` (id, user_id, name, timestamps) — tam RLS (select/insert/update/delete, hepsi `auth.uid() = user_id`).
- `playlist_tracks` (playlist_id, track_id, position, added_at) — RLS, `playlists` ile join üzerinden sahiplik kontrolü yapıyor (kendi `user_id`'si yok).
- Her iki tablo da `supabase_realtime` publication'a eklendi.

### apps/web/lib/playlists
- `usePlaylists.ts` — playlist listesi + Realtime abonelik (`postgres_changes` → `refresh()`), `createPlaylist`/`renamePlaylist`/`deletePlaylist`.
- `usePlaylistTracks.ts` — bir playlist'in parçaları (join ile `tracks.title/artist/duration_seconds`) + Realtime, `addTrack`/`removeTrack`/`move` (yukarı/aşağı sıralama, `position` swap'ı ile).

### apps/web/app/playlists
- `page.tsx` — playlist listesi + oluşturma formu + silme.
- `[playlistId]/page.tsx` — parça listesi (sırala/kaldır) + "Parça Ekle" bölümü: kullanıcının tüm parçalarını (`GET /tracks`, mevcut NestJS uç noktası) çekip **parça adı/sanatçı/etikete göre client-side arama/filtreleme** yapıyor (Bölüm 7 Ajan 8: "Arama ve filtreleme").

### Depolama Kotası (apps/api/src/uploads)
- `upload-validation.ts`: `getStorageQuotaBytes()` (env `MAX_STORAGE_BYTES_PER_USER`, varsayılan 2 GB) + saf `wouldExceedStorageQuota(currentUsage, incoming, quota)` fonksiyonu (birim testli).
- `tus-upload.middleware.ts`: `enforceStorageQuota()` — MIME doğrulamasından hemen sonra, **FFmpeg normalizasyonu gibi pahalı işlerden önce**, kullanıcının `tracks.size_bytes` toplamını kontrol edip kota aşılırsa `413` ile reddediyor. `tracks` insert'ine artık gerçek normalize edilmiş dosya boyutu (`size_bytes`) yazılıyor.

### PWA Genişletmesi (apps/web/public/sw.js)
- Stage 07'nin ses önbellekleme mantığına ek olarak, **`GET /tracks` ve `GET /tracks/:id` API yanıtları** artık network-first + cache-fallback stratejisiyle önbelleğe alınıyor — "son açılan projelerin/parça listelerinin çevrimdışı erişimi" (Bölüm 7 Ajan 8).

## Önemli Bulgu: İki Ek Çökme Hatası (bu ajan tarafından bulunup düzeltildi)

Gerçek tarayıcı testinde, Stage 7'de bulduğum `lib/supabase/middleware.ts` çökme hatasının **aynısının** iki yerde daha var olduğu ortaya çıktı:
1. **`lib/supabase/client.ts`** (tarayıcı Supabase istemcisi) — env değişkenleri eksikken senkron olarak fırlatıyordu, bu da `/playlists`, `/upload`, `/account` gibi Supabase kullanan **her** istemci bileşenini çökertiyordu.
2. **`lib/supabase/server.ts`** (sunucu bileşeni istemcisi) — aynı sorun, `/tracks/[trackId]` gibi sayfaları etkiliyordu.

Her ikisi de aynı desenle düzeltildi: env eksikse yer tutucu (`placeholder.supabase.co`) değerlerle client yine de oluşturuluyor; gerçek istekler artık senkron çökme yerine zarif bir ağ hatası olarak başarısız oluyor. **11 rotanın tamamı** (`/`, `/login`, `/signup`, `/forgot-password`, `/legal/*`, `/account`, `/upload`, `/playlists`, `/tracks/[id]`, `/dev/player-demo`) taranıp hepsinin artık hatasız (yalnızca beklenen ağ hataları) render olduğu doğrulandı.

Ayrıca bir kerelik, gerçek olmayan bir "Jest worker encountered N child process exceptions" hatasıyla karşılaşıldı — bu, **uzun süredir çalışan bir dev server + eski Turbopack önbelleğinin bozulmasıydı**, kod hatası değildi; `.next` silinip sunucu yeniden başlatılınca kayboldu. Not: gelecekteki ajanlar tuhaf/açıklanamayan hatalarla karşılaşırsa önce temiz bir `.next` + taze dev server ile tekrar denemeli.

## Gerekli Ortam Değişkenleri

- `apps/api/.env.example`: `MAX_STORAGE_BYTES_PER_USER` eklendi (varsayılan 2 GB).

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Realtime senkronizasyonun kendisi (iki cihaz arası anlık görünme) gerçek bir Supabase projesi olmadan canlı doğrulanamadı.** Kod, resmi Supabase Realtime + RLS deseniyle yazıldı ve UI'lar hatasız render oluyor, ama "cihaz A'da ekle, cihaz B'de anında gör" senaryosu proje sahibi tarafından gerçek Supabase bağlandıktan sonra manuel doğrulanmalı.
- Playlist yeniden adlandırma (rename) için UI eklenmedi (hook'ta `renamePlaylist` var ama sayfada buton yok) — küçük bir eksik, kolayca eklenebilir.
- Sürükle-bırak (drag-and-drop) sıralama yerine yukarı/aşağı butonları kullanıldı — daha basit, dokunmatik cihazlarda da güvenilir; istenirse ileride bir sürükle-bırak kütüphanesiyle değiştirilebilir.
- Depolama kotası aşıldığında istemci tarafında (upload sayfası) kullanıcıya "kotanız doldu" gibi özel bir mesaj gösterilmiyor — `tus.Upload`'ın `onError` callback'i backend'in 413 hata mesajını gösteriyor ama kullanıcı dostu bir metne çevrilmedi.
