# Stage 07 — Web/PWA Oynatıcı Arayüzü (Multi-Track Player)

**Ajan:** 7 (Web/PWA Oynatıcı Arayüzü)
**Bağımlılık:** Ajan 4, Ajan 5, Ajan 6 (tamamlandı)
**Durum:** Kod tamamlandı, build/lint/test yeşil, **ve gerçek bir tarayıcıda (Playwright/Chromium) uçtan uca test edilip ekran görüntüleriyle doğrulandı** — bu, Supabase bağlanana kadar ulaşılabilecek en yüksek doğrulama seviyesidir.

## Ne İnşa Edildi

### apps/web/lib/player (motor — framework-agnostic)
- `PlayerEngine.ts` — 6 stem'i **tek bir waveform'a** (wavesurfer.js v7, sessiz/yalnızca görsel) senkronize eden çekirdek sınıf. Araştırılan standart mimari: waveform "conductor" (kumandacı) görevi görür, gerçek ses 6 bağımsız `<audio>` elementinden gelir; senkronizasyon periyodik `currentTime` düzeltmesiyle (>50ms sapmada) sağlanır. Loop, `wavesurfer.js`'in resmi Regions eklentisiyle (`enableDragSelection` — waveform üzerinde sürükleyerek bölge oluşturma) uygulanır.
- `Metronome.ts` — Web Audio API look-ahead scheduler (Chris Wilson'ın klasik "A Tale of Two Clocks" tekniği) ile sample-accurate metronom + özelleştirilebilir geri sayım (count-in).
- `usePlayerEngine.ts` — React hook sarmalayıcısı (mikser durumu, loop, metronom, count-in, tempo/ton dönüşümü kaynak değiştirme).
- `types.ts`, `api.ts` — paylaşılan tipler ve `GET /tracks/:id` istemci fonksiyonu.

### apps/web/components/player (UI)
- `PlayerView.tsx` — ana entegrasyon bileşeni: başlık, akor şeridi, waveform, transport kontrolleri (çal/duraklat, geri sayım seçimi, metronom aç/kapa), loop kontrolleri, 6 kanallı mikser, tempo/ton kontrolleri. Tamamen responsive (mobil: 2 kolon mikser, tablet/masaüstü: 3/6 kolon).
- `MixerChannel.tsx` — kanal başına ses seviyesi (dikey slider), mute (M) ve solo (S) butonları.
- `ChordStrip.tsx` — oynatma pozisyonuna göre aktif akoru vurgulayan yatay şerit.
- `LoopControls.tsx`, `TempoControls.tsx` — loop bilgisi/temizleme; tempo(%)/ton(yarım ses) sürgüleri + "Uygula" butonu (her sürgü hareketinde değil, yalnızca **Uygula**'ya basınca `apps/api`'nin `/transform` proxy'sini çağırır — Ajan 6'nın SoundTouch motorunu tetikler).

### apps/web/app
- `tracks/[trackId]/page.tsx` — sunucu bileşeni: oturumu kontrol eder, `GET /tracks/:id`'den imzalı URL'lerle track verisini çeker, `PlayerView`'i render eder.
- `upload/page.tsx` — **yeni**: `tus-js-client` ile dosya yükleme arayüzü (ilerleme çubuğu). Yükleme bitince `onSuccess` callback'i tus'un response body'sinden (`{trackId, jobId}`) parse edip doğrudan `/tracks/{trackId}`'e yönlendirir.
- `dev/player-demo/page.tsx` — **yalnızca geliştirme**: gerçek Supabase olmadan `PlayerView`'i test etmek için sahte veri + yerel `public/demo/*.wav` dosyaları kullanır, kimlik doğrulama gerektirmez.
- `manifest.ts` — PWA web manifest (Next.js'in yerel `app/manifest.ts` konvansiyonu — `next-pwa` gibi ek pakete gerek kalmadı).
- `public/sw.js` + `components/ServiceWorkerRegistration.tsx` — elle yazılmış, minimal bir service worker: ses dosyalarını (`.wav`/`.mp3`/`.m4a` veya Supabase imzalı Storage URL'leri) **query string'i (imza token'ı) atılmış normalize edilmiş path** ile önbelleğe alır — aksi halde her ziyarette yeni üretilen imzalı URL farklı olacağından önbellek hep ıskalanırdı.

### apps/api (Stage 7'yi desteklemek için eklenen uç noktalar)
- `src/tracks/tracks.controller.ts` — **yeni modül**: `GET /tracks` (kullanıcının parça listesi), `GET /tracks/:id` (parça + en son iş çıktısı — stem'ler için **imzalı Supabase Storage URL'leri**, `createSignedUrl` ile 1 saatlik geçerlilik). Sahiplik kontrolü + imzalı URL'lerden ayrı olarak `/transform` çağrıları için ham `stemPaths` de döner.
- `src/uploads/tus-upload.middleware.ts` (güncelleme): `onUploadFinish` artık `{trackId, jobId}`'i tus response body'sinde döndürüyor — `tus-js-client`'ın `onSuccess(payload).lastResponse.getBody()` API'si üzerinden istemci tarafından okunabiliyor (tus spesifikasyonu response body öngörmez ama yaygın istemciler destekler, bu tip tanımlarından doğrulandı).

## Gerçek Tarayıcı Testi (bu ajan tarafından Playwright/Chromium ile bizzat çalıştırıldı)

Gerçek Supabase olmadan (`/dev/player-demo` + yerel ffmpeg ile üretilmiş 6 sahte stem + 4 akorlu sahte veri):

- **Waveform render**: ✅ görsel dalga formu doğru çiziliyor.
- **Akor şeridi**: ✅ `t=0`'da "Am" doğru vurgulanıyor (segment `{0-2: Am}`).
- **Çal + geri sayım**: ✅ "Çal" → "Duraklat"a değişiyor, ~2.1sn count-in sonrası gerçekten oynatma başlıyor (waveform progress dolumu ölçüldü), zaman sayacı `timeupdate` ile doğru ilerliyor (0:00 → 0:01).
- **Metronom aç/kapa**: ✅ buton durumu ve stili doğru değişiyor.
- **Mikser mute**: ✅ Vokal kanalının Mute butonu `aria-pressed="true"` oluyor.
- **Loop (waveform'da sürükleme)**: ✅ %20-%50 arası sürükleme, 8 saniyelik parçada **"Loop: 1.6s – 4.1s"** olarak doğru segmentlendi (region resmi de waveform üzerinde göründü).
- **Responsive**: ✅ mobil (390px), tablet (820px), masaüstü (1440px) — üçünde de layout doğru kırılıyor, yatay taşma yok.
- **Service Worker**: ✅ `/` sayfasında kayıt olup `activated` durumuna geçiyor.
- **Konsol hatası**: Tüm testler boyunca **sıfır** konsol hatası/uncaught exception.

Bu, oynatıcının çekirdek etkileşimlerinin gerçekten çalıştığını kanıtlıyor. Tempo/ton "Uygula" butonunun gerçek `/transform` çağrısı ve gerçek bir Supabase job'ından uçtan uca oynatma, gerçek Supabase/AI servisi olmadan test edilemedi (aynı, önceki stage'lerde de not edilen sınırlama).

## Mimari Kararlar (gerekçesiyle)

- **Waveform + 6 ayrı `<audio>` mimarisi**: Araştırma, `wavesurfer-multitrack` eklentisinin ticari/ücretli olduğunu ve 6 ayrı wavesurfer instance'ının israf olacağını gösterdi. Bunun yerine tek (sessiz) waveform + 5 senkronize `<audio>` elementi + periyodik drift düzeltmesi standart/ücretsiz yaklaşım olarak seçildi.
- **Tempo/ton "canlı sürgü" değil "Uygula" butonu**: Her piksel hareketi backend'e SoundTouch çağrısı yapmak hem yavaş hem maliyetli olur (Bölüm 9.4). Kullanıcı değeri seçip "Uygula"ya bastığında tek bir istek atılır.
- **`/dev/player-demo` rotası**: Gerçek bulut altyapısı olmadan UI'ı gerçekten test edebilmek için eklendi. **Ajan 10 (lansman hazırlığı) bu rotayı production'a göndermeden önce kaldırmayı veya `NODE_ENV` ile gizlemeyi değerlendirmeli** — şu an zararsız (gerçek veriye erişmiyor) ama gereksiz.

## Önemli Bulgu: Proxy Middleware Çökme Hatası (bu ajan tarafından bulunup düzeltildi)

Gerçek tarayıcıda ilk testte **her tek istek** `lib/supabase/middleware.ts`'de çöküyordu: `createServerClient()` env değişkenleri `undefined` iken senkron olarak fırlatıyor. Bu, Stage 1/2'de "Supabase olmadan da uygulama ayağa kalkmalı" ilkesinin **proxy/middleware katmanında ihlal edildiği** anlamına geliyordu — yalnızca `next build` ile fark edilemez, yalnızca gerçek bir istek (`next dev` + tarayıcı) ile ortaya çıkar. Düzeltildi: `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` eksikse middleware artık sessizce `NextResponse.next()` ile geçiyor (korumalı sayfalar bu durumda oturumsuz kalır ama uygulama çökmez). **Bu, "sadece build ile doğrulama yeterli" varsayımının riskini gösteriyor — ileride bir sonraki ajan gerçek bir dev server + tarayıcı testi olmadan asla 'çalışıyor' dememeli.**

## Gerekli Ortam Değişkenleri

Yeni yok. `NEXT_PUBLIC_API_URL` (Stage 1), Supabase değişkenleri (Stage 2) zaten kullanılıyor.

## Demo Test Dosyalarını Yeniden Üretme

`apps/web/public/demo/*.wav` git'e dahil edilmedi (`.gitignore`'a eklendi — binary test fixture'ları repo şişirmesin diye). Yeniden üretmek için (LGPL FFmpeg gerekir — bkz. README):

```bash
mkdir -p apps/web/public/demo
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=8" -ar 44100 apps/web/public/demo/vocals.wav
ffmpeg -y -f lavfi -i "sine=frequency=110:duration=8" -ar 44100 apps/web/public/demo/bass.wav
ffmpeg -y -f lavfi -i "aevalsrc=0.5*sin(2*PI*200*t)*lt(mod(t\,0.5)\,0.05):d=8" -ar 44100 apps/web/public/demo/drums.wav
ffmpeg -y -f lavfi -i "sine=frequency=330:duration=8" -ar 44100 apps/web/public/demo/guitar.wav
ffmpeg -y -f lavfi -i "sine=frequency=523:duration=8" -ar 44100 apps/web/public/demo/piano.wav
ffmpeg -y -f lavfi -i "sine=frequency=660:duration=8" -ar 44100 apps/web/public/demo/other.wav
ffmpeg -y -i apps/web/public/demo/vocals.wav -i apps/web/public/demo/bass.wav -i apps/web/public/demo/drums.wav \
  -i apps/web/public/demo/guitar.wav -i apps/web/public/demo/piano.wav -i apps/web/public/demo/other.wav \
  -filter_complex "amix=inputs=6:duration=longest" -ar 44100 apps/web/public/demo/mix.wav
```

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Bölüm 6.7 (i18n) henüz hiçbir stage'de uygulanmadı.** `next-intl` kurulmadı, tüm metinler şu an sabit Türkçe. Bu, tüm ajanlara zorunlu genel kural olmasına rağmen bugüne kadar atlandı — bir sonraki ajan (veya Ajan 10) bunu ele almalı; geriye dönük tüm sayfaları i18n'e taşımak büyük bir iş olacağından, ideal olarak mümkün olduğunca erken yapılmalı.
- Gitar/piyano akor diyagramı (Ajan 5'in "opsiyonel/ileri seviye" notu) bu stage'de de eklenmedi.
- `/dev/player-demo` rotası üretime gönderilmeden önce kaldırılmalı/gizlenmeli (yukarıya bkz.).
- Tempo/ton dönüşümü uygulandığında yalnızca stem `<audio>` kaynakları değişiyor; waveform (görsel referans) hâlâ orijinal hızda/tondaymış gibi görünmeye devam ediyor (senkron sorunu değil, sadece görsel — waveform'un da orijinal `rawUrl`'den yeniden render edilmesi gerekebilir, bu ileri bir iyileştirme olarak bırakıldı).
- Playlist/proje organizasyonu (Ajan 8'in kapsamı) henüz yok — `/upload` sonrası kullanıcı doğrudan oynatıcıya düşüyor, "projelerim" gibi bir liste sayfası yok.
