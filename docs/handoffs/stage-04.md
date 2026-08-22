# Stage 04 — Yapay Zeka Ses Ayırma Motoru (Stem Separation)

**Ajan:** 4 (Yapay Zeka Ses Ayırma Motoru)
**Bağımlılık:** Ajan 3 (tamamlandı)
**Durum:** Kod tamamlandı, build/lint/test yeşil, **ve Demucs ile gerçek bir ses dosyası üzerinde uçtan uca çalıştırılıp doğrulandı** (aşağıya bkz.).

## Ne İnşa Edildi

### apps/ai-service/app/services
- `separation.py` — `demucs.api.Separator` (`htdemucs_6s` modeli) ile 6 kanal (vokal, davul, bas, gitar, piyano, diğer) ayırma:
  - Model, süreç içinde tek seferlik yüklenip (`@lru_cache`) yeniden kullanılır (ağırlıkları tekrar tekrar yüklemek pahalı).
  - CPU-bound/bloklayan `separate_audio_file` çağrısı `asyncio.to_thread` ile bir thread'de çalıştırılır (event loop'u bloklamaz).
  - Eşzamanlılık, `MAX_CONCURRENT_JOBS` ile boyutlandırılmış bir `asyncio.Semaphore` ile sınırlanır (Bölüm 7 Ajan 4: "Kaynak yönetimi").
  - Supabase Storage'dan indirme → ayırma → 6 stem'i tekrar Storage'a (`stems/{jobId}/{name}.wav`) yükleme akışı.
  - Bozuk/okunamayan ses dosyaları `UnsupportedAudioError` ile yakalanıp anlamlı bir hataya çevrilir.
- `supabase_client.py` — Python tarafı için lazy-init service-role Supabase client'ı (Node tarafındaki `SupabaseService` ile aynı desen).

### apps/ai-service/app/routers
- `separate.py` — `POST /separate` (`{jobId, storagePath}` → `{stems: {name: storagePath}}`). Hata kodları: `422` (desteklenmeyen/bozuk dosya), `500` (yapılandırma eksik veya beklenmeyen hata).

### apps/api/src/queue
- `stem-separation.worker.ts` — **artık placeholder değil**: `AI_SERVICE_URL`'e `POST /separate` isteği atar, sonucu `jobs.output`'a yazar (`status: done`), hata durumunda `jobs.error`'a yazıp `status: failed` yapar. BullMQ `Worker` seçeneklerine `concurrency: MAX_CONCURRENT_JOBS` eklendi.

## Önemli Bulgu: Python Sürüm Uyumsuzluğu Çözüldü (Stage 01'de işaretlenmişti)

Stage 01 handoff'unda not edilen risk gerçekleşti: `numpy` 2.5.2'nin tip stub'ları Python 3.12+ sözdizimi (`type X = ...`) kullanıyor, ama proje `mypy`/`ruff`/`black`'i **3.11** hedefleyecek şekilde yapılandırılmıştı. Bu çakışma **çözüldü**:
- `apps/ai-service/pyproject.toml`: `target-version`/`python_version` → **3.12**.
- `apps/ai-service/Dockerfile`: base image → `python:3.12-slim`.
- `.github/workflows/ci.yml`: `ai-service` job'u → Python **3.12**.

## Bağımlılık Kurulumu Notu (CPU-only PyTorch)

`requirements.txt` artık `--index-url https://download.pytorch.org/whl/cpu` + `--extra-index-url https://pypi.org/simple` direktifleriyle başlıyor — **tek bir** `pip install -r requirements.txt` komutu hem `torch`/`torchaudio`'yu CPU-only (CUDA'sız, küçük) index'ten hem de `demucs`/`fastapi`/`supabase` gibi diğer paketleri PyPI'den doğru şekilde çözüyor. Bu, temiz bir venv'de bizzat test edilip doğrulandı. `Dockerfile` de aynı tek adımı kullanıyor; ayrıca **build sırasında** `htdemucs_6s` modelini önceden indirip cache'e alan bir `RUN` adımı eklendi (ilk gerçek isteğin model indirme gecikmesi yaşamaması için).

## Gerçek Uçtan Uca Test (bu ajan tarafından bizzat çalıştırıldı)

FFmpeg (LGPL) ile üretilen 5 saniyelik gerçek bir stereo WAV dosyası, `demucs.api.Separator(model="htdemucs_6s")` ile ayrıldı:
- Model ağırlıkları ilk çağrıda otomatik indirildi (Hugging Face Hub üzerinden).
- **10.4 saniyede** 6 stem dosyası (`drums`, `bass`, `other`, `vocals`, `guitar`, `piano`) başarıyla üretildi, her biri doğru boyutta (girdiyle aynı süre/örnekleme hızında).
- Bu, Demucs entegrasyonunun gerçekten çalıştığını kanıtlıyor (Supabase Storage adımı hariç — bu adım gerçek bir Supabase projesi gerektirir ve bu ajan tarafından canlı test edilemedi, bkz. stage-02/03 handoff'larındaki aynı sınırlama).

## Lisans (Bölüm 9.2)

`demucs` paketi **ve** `htdemucs_6s` model ağırlıkları **MIT** lisanslıdır — projenin "GPL'den kaçın" kısıtıyla tam uyumlu, ek bir doğrulama/aksiyon gerekmiyor.

## Gerekli Ortam Değişkenleri

Yeni eklenen yok — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `MAX_CONCURRENT_JOBS` (ai-service) ve `AI_SERVICE_URL` (api) zaten Stage 01/03'te tanımlıydı, bu stage'de fiilen kullanılmaya başlandı.

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Piyano stem'i diğer 5 kanala göre daha zayıf kalitede** — bu, Demucs modelinin bilinen bir sınırlaması (araştırmayla doğrulandı), kodun bir hatası değil. Ajan 7 (oynatıcı arayüzü) kullanıcıya bunu bekleyeceği şekilde iletebilir (ör. "piyano ayrımı deneyseldir" notu).
- CPU'da bir parçanın ayrılması gerçek şarkı uzunluğunda **~1.5x parça süresi** sürebilir (ör. 4 dakikalık şarkı için ~6 dakika) — ücretsiz/paylaşımlı CPU hosting'de bu daha da uzayabilir. Bu, Bölüm 9.1'de zaten öngörülen bir risktir; BullMQ worker bunu arka planda işlediği için kullanıcı deneyimini bloklamaz, ama Ajan 10'un yük testinde bu süre dokümante edilmeli.
- Gerçek Supabase Storage bağlantısı olmadan bu ajan, `separate_track()`'in Storage indirme/yükleme adımlarını canlı doğrulayamadı (yalnızca çekirdek `_run_separation_sync` gerçek Demucs ile test edildi). Proje sahibi gerçek Supabase bağlandıktan sonra tam akışı (yükle → kuyruğa düş → AI servisi çağrılsın → stem'ler Storage'da görünsün → `jobs.status = done`) uçtan uca doğrulamalı.
- Model ağırlıkları ilk çalıştırmada internet bağlantısı gerektirir (Hugging Face Hub); üretimde `Dockerfile`'daki pre-warm adımı bunu build-time'a taşıyor, ama free-tier hosting ortamının build sırasında da internet erişimi olduğundan emin olunmalı.
