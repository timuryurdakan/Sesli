# Stage 05 — Akıllı Akor Tespiti Motoru

**Ajan:** 5 (Akıllı Akor Tespiti Motoru)
**Bağımlılık:** Ajan 3 (tamamlandı). Ajan 4 ile paralel yürütüldü.
**Durum:** Kod tamamlandı, build/lint/test/mypy yeşil, **ve sentetik ama gerçek ses sinyalleri üzerinde algoritmik doğruluğu kanıtlanmış durumda** (aşağıya bkz.).

## Lisans Araştırması Sonucu (build öncesi zorunlu doğrulama — Bölüm 9.2)

Açık kaynak, projenin "GPL'den kaçın" kısıtına uyan, gerçek anlamda bakımı yapılan bir hazır akor tanıma kütüphanesi **bulunamadı**:
- `madmom`: kod BSD ama pretrained CNN/CRF modelleri **CC BY-NC-SA 4.0** (ticari kullanım yasak) — proje için kabul edilemez. Ayrıca Python 3.10+ ile uyumluluk sorunları var.
- `essentia`: **AGPLv3** (kapalı kaynak için ayrı ücretli lisans gerekiyor).
- `autochord` (Apache-2.0): kendisi permissive ama özellik çıkarımı **GPL-2+ lisanslı NNLS-Chroma/Chordino VAMP eklentisine** bağımlı — zincirleme GPL riski taşıyor.
- Akademik "Chord-CNN-CRF" tipi repolar: PyPI'de yok, lisans belirsiz/GPL.

**Karar:** Klasik Fujishima (1999) chroma template-matching + Sheh & Ellis (2003) tarzı HMM/Viterbi düzeltmesi **kendi kod tabanımızda** uygulandı — yalnızca `librosa` (MIT) ve `numpy` üzerine kurulu, hiçbir GPL/AGPL/NC bağımlılığı yok. Literatürde bu yaklaşımın temel majör/minör akorlarda ~%60-75 kare-bazlı doğruluk verdiği biliniyor (dedicated CNN/CRF modellere göre ~10-20 puan daha düşük) — 7'li/uzatılmış akorlar ve inversiyonlar hedeflenmiyor, bu MVP kapsamı için kabul edilebilir.

## Ne İnşa Edildi

### apps/ai-service/app/services/chord_detection.py
- 24 akor şablonu (12 kök × majör/minör), ikili (binary) Fujishima şablonlarının döngüsel kaydırılmasıyla üretiliyor, L2-normalize.
- `librosa.effects.hpss` ile harmonik/perküsif ayrıştırma (davulün akor tespitini bozmasını azaltmak için — Demucs stem'lerine bağımlı olmadan, ham sesle çalışabilmesi için).
- `librosa.feature.chroma_cqt` ile kroma özellik çıkarımı (`hop_length=4096`, ~185ms/kare).
- Her kare için L2-normalize kroma vektörü ile 24 şablon arasında kosinüs benzerliği; sonuçlar pseudo-likelihood'a çevriliyor.
- **Log-domain Viterbi** ile zaman içinde düzeltme (self-transition olasılığı 0.95, kalan 0.05 diğer 23 akora eşit dağılıyor) — ani/gürültülü akor geçişlerini bastırıyor (Bölüm 7 Ajan 5: "post-processing... filtreleme").
- Ardışık aynı etiketli kareler tek bir segmente birleştiriliyor → `[{start, end, chord}, ...]` (Bölüm 11 sözleşmesiyle birebir uyumlu).

### apps/ai-service/app/routers/chords.py
- `POST /chords` (`{storagePath}` → `{chords: [...]}`). Stem ayırmadan bağımsız, ham/normalize edilmiş sesi kullanır.

### apps/ai-service/app/services/supabase_client.py
- Ortak `download_from_storage`/`upload_to_storage` yardımcıları buraya taşındı (önceden `separation.py` içinde özel/private'tı, `chords.py` ile paylaşılabilmesi için genel bir yere alındı).

### apps/api/src/queue (rename + genişletme)
- `stem-separation.*` dosyaları **`track-processing.*`** olarak yeniden adlandırıldı (`StemSeparationWorker` → `TrackProcessingWorker`, kuyruk adı `stem-separation` → `track-processing`) — worker artık yalnızca stem ayırma değil, tüm parça analiz hattını (ayırma + akor + ileride tempo) yönettiği için isim güncellendi.
- `TrackProcessingWorker.process()`: önce `POST /separate`, ardından `POST /chords` çağırır; ikisinin sonucunu `packages/shared-types`'taki `StemJobOutput` sözleşmesine (`stems`, `chords`, `bpm`, `key`) uygun tek bir `jobs.output` JSON'ında birleştirir.
- Tekrar eden fetch/hata-yönetimi mantığı `callAiService<T>()` adlı ortak bir private metoda çıkarıldı (Stage 6'nın `/tempo` çağrısı da aynı deseni kullanacak).

## Gerçek Doğruluk Testi (bu ajan tarafından bizzat çalıştırıldı)

`numpy`/`soundfile` ile üretilen gerçek sinüs-toplamı ses sinyalleri üzerinde:
- **C majör** (C-E-G, 3sn) → doğru şekilde `"C"` tespit edildi.
- **A minör** (A-C-E, 3sn) → doğru şekilde `"Am"` tespit edildi.
- **C majör → G majör geçişi** (2.5sn + 2.5sn) → `[{0.00-2.5x: "C"}, {2.5x-5.0x: "G"}]` olarak doğru segmentlendi, geçiş sınırı gerçek kesim noktasına çok yakın çıktı.

Bu üç senaryo da `tests/test_chord_detection.py`'ye kalıcı regresyon testi olarak eklendi (CI'da her PR'da çalışır, harici ses dosyasına ihtiyaç duymadan `numpy`/`soundfile` ile anlık üretiliyor).

## Gerekli Ortam Değişkenleri

Yeni yok — mevcut `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` kullanılıyor.

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Yalnızca temel majör/minör üçlü akorlar** tespit ediliyor — 7'li (dom7, maj7, min7), sus, dim/aug, inversiyonlar desteklenmiyor. İleride genişletilmek istenirse şablon setine bu akor tiplerini eklemek yeterli (aynı Viterbi/kosinüs-benzerlik altyapısı kullanılabilir).
- Gerçek, karmaşık bir şarkı (çoklu enstrüman, gerçek kayıt gürültüsü) üzerinde doğruluk henüz ölçülmedi — yalnızca sentetik/temiz sinyallerle doğrulandı. Ajan 10 (entegrasyon) veya proje sahibi, gerçek şarkılarla manuel dinleme testi yapmalı (Bölüm 7 Ajan 5 DoD'si: "en az 5 test şarkısında... kabul edilebilir doğrulukta").
- `hop_length=4096` (~185ms) segment çözünürlüğü hızlı akor değişimlerinde (ör. funk/jazz walking bass) kaba kalabilir; gerekirse küçültülüp (ör. 2048) performans/hassasiyet dengesi yeniden değerlendirilebilir.
- Gitar/piyano için akor diyagramı/parmak pozisyonu gösterimi (Bölüm 7 Ajan 5: "opsiyonel/ileri seviye") bu stage'e dahil edilmedi — Ajan 7 (oynatıcı arayüzü) istenirse ekleyebilir.
