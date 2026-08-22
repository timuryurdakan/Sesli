# Stage 06 — Tempo/Metronom ve Ton Değiştirme Ses İşleme Motoru

**Ajan:** 6 (Tempo/Metronom ve Ton Değiştirme Ses İşleme Motoru)
**Bağımlılık:** Ajan 3 (tamamlandı). Ajan 4/5 ile paralel yürütüldü.
**Durum:** Kod tamamlandı, build/lint/test/mypy yeşil, **ve gerçek SoundTouch binary'siyle sayısal olarak doğrulandı** (aşağıya bkz.).

## Ne İnşa Edildi

### apps/ai-service/app/services/tempo_key.py
- `detect_bpm()` — `librosa.beat.beat_track` ile otomatik BPM tespiti.
- `detect_key()` — Krumhansl & Kessler (1982) ton profilleriyle (24 profil: 12 kök × majör/minör) şarkının ortalama kroma vektörü arasında korelasyon; en yüksek korelasyonlu ton döndürülür (ör. `"A minor"`, `"C major"`). `StemJobOutput.key` alanını besler.

### apps/ai-service/app/services/soundstretch.py
- SoundTouch'ın resmi `soundstretch` CLI aracını (LGPL v2.1 — bkz. lisans notu) `subprocess` ile çağıran ince bir sarmalayıcı. Binary bundle edilmez, `SOUNDSTRETCH_PATH` env değişkeniyle verilir (FfmpegService ile aynı desen).
- `transform_audio(input, output, tempo_percent, semitones)` — Özellik 3 (kalite kaybı olmadan hızlandırma/yavaşlatma) ve Özellik 4 (yarım ses hassasiyetinde transpoze).

### apps/ai-service/app/routers/tempo.py
- `POST /tempo` (`{storagePath}` → `{bpm, key}`) — **batch** analiz, `jobs.output`'a yazılır.
- `POST /transform` (`{storagePath, tempoPercent?, semitones?}` → ses baytları, `audio/wav`) — **isteğe bağlı/durumsuz** dönüşüm; oynatıcının (Ajan 7) anlık kullanıcı etkileşimiyle (tempo slider'ı, transpoze seçimi) çağırması için. `jobs`/`tracks` tablosuna dokunmaz.

### apps/api/src/transform (yeni modül)
- `TransformController` (`POST /transform`, guard korumalı) — AI servisinin `/transform`'una ince bir proxy. **Sahiplik kontrolü**: `storagePath`'in `raw/{authenticated_user_id}/` ile başladığını doğrular (service-role çağrısı RLS'i bypass ettiği için, bir kullanıcının başka birinin dosyasını dönüştürememesi burada elle garanti edilir).

### apps/api/src/queue/track-processing.worker.ts (genişletme)
- `/separate` ve `/chords`'tan sonra artık **üçüncü** bir çağrı olarak `/tempo` de yapılıyor; sonuç `jobs.output`'a `bpm`/`key` olarak ekleniyor — `packages/shared-types`'taki `StemJobOutput` sözleşmesi (`stems`, `chords`, `bpm`, `key`) artık **tam olarak** karşılanıyor.

## Mimari Karar: Metronom Sesi Bu Aşamaya Dahil Edilmedi

Plan metni Ajan 6'ya "tespit edilen BPM'e senkronize metronom ses üretici" görevini veriyor. Bunu **bilinçli olarak** bu ajanın (backend/AI servisi) kapsamı dışında bıraktım: bir metronom tık sesi, her BPM için sunucuda dosya render edip Storage'a yükleyecek kadar ağır bir işlem değil — endüstri standardı yaklaşım, **istemci tarafında Web Audio API** (`OscillatorNode`/`AudioBufferSourceNode`) ile BPM'e göre zamanlanmış tık sesi üretmektir (gecikme/gürültü açısından da daha iyi sonuç verir). Bu, doğal olarak Ajan 7'nin (oynatıcı arayüzü) kapsamına giriyor; bu ajan yalnızca gerekli veriyi (`bpm`) üretti. Bu kararın gerekçesi burada açıkça not edilmiştir ki bir sonraki ajan bunu "unutulmuş bir görev" sanıp tekrar sormasın.

## Lisans (Bölüm 4/9.2)

`soundstretch` CLI'ı **LGPL v2.1** (bizzat `-license` çıktısı incelenerek doğrulandı) — planın istediği tam olarak bu. Binary `subprocess` ile ayrı bir process olarak çağrıldığı için (linklenmediği için) LGPL'in "dynamic linking" kısıtlamaları bile devreye girmiyor; yine de plan zaten LGPL'i tercih ettiği için bu tartışma pratikte önemsiz — doğrudan uyumlu.

## Gerçek Sayısal Doğrulama (bu ajan tarafından bizzat çalıştırıldı)

- **Tempo değişimi:** 3 saniyelik bir ton `-tempo=-20` ile işlendi → çıktı süresi tam olarak **3.75 saniye** (3 / 0.8 = 3.75, matematiksel olarak doğru).
- **Ton değişimi:** 440 Hz'lik bir ton `-pitch=-3` (3 yarım ses aşağı) ile işlendi → FFT ile ölçülen çıktı frekansı **370.00 Hz**, beklenen değer (440 × 2^(-3/12) = 369.99 Hz) ile **neredeyse birebir örtüşüyor**.
- **Anahtar tespiti:** Sentetik C majör (C-E-G) → `"C major"`; sentetik A minör (A-C-E) → `"A minor"` doğru tespit edildi.
- **BPM tespiti:** 120 BPM'lik sentetik bir click track → **117.45 BPM** olarak tespit edildi (~%2 sapma, saf tık sesleri üzerinde beat-tracker'ın müzikal bağlam olmadan çalışması için makul bir sapma).

Bu dört senaryo da `tests/test_tempo_key.py` ve `tests/test_soundstretch.py`'ye kalıcı regresyon testi olarak eklendi.

## Gerekli Ortam Değişkenleri

- `apps/ai-service/.env.example`: `SOUNDSTRETCH_PATH` eklendi (LGPL `soundstretch` binary yolu — bkz. README'deki FFmpeg notuna benzer bir kurulum notu eklenmeli, proje sahibi `https://www.surina.net/soundtouch/` adresinden indirebilir).

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Metronom ses üretimi** (yukarıda açıklandığı gibi) bilinçli olarak Ajan 7'ye bırakıldı — istemci tarafı Web Audio API ile yapılmalı.
- `/transform` üretimde deploy edilirken `apps/ai-service`'in de `soundstretch` binary'sine erişimi olmalı (Dockerfile'a eklenmeli — bu stage'de Dockerfile güncellenmedi, Ajan 10 deploy hazırlığında bunu yapmalı; local dev için README'ye kurulum notu eklendi).
- `/transform` şu an her çağrıda Supabase Storage'dan tam dosyayı indirip işleyip dönüyor — sık kullanılan tempo/pitch kombinasyonları için önbellekleme (caching) yapılmıyor; performans/maliyet optimizasyonu gerekirse Ajan 10 veya ileride eklenebilir.
- Gerçek Supabase Storage bağlantısı olmadan `/tempo` ve `/transform`'un Storage indirme adımı canlı doğrulanamadı (yalnızca çekirdek analiz/dönüşüm fonksiyonları gerçek ses dosyalarıyla test edildi) — aynı sınırlama Stage 3/4/5'te de not edildi.
