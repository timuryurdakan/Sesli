# Yük Testi (Bölüm 7 Ajan 10)

Artillery kullanıldı (k6 bu ortamda sistem düzeyinde kurulum gerektirdiği ve interaktif onay istediği için — plan zaten "k6 **veya** Artillery" diyor, Artillery npm ile kurulabildiği için tercih edildi).

## Çalıştırma

```bash
# apps/api ve apps/ai-service yerelde çalışıyor olmalı (gerçek Supabase/Redis gerekmez —
# bu testler yalnızca HTTP katmanının eşzamanlı istek altındaki davranışını ölçer)
npx artillery run infra/load-test/artillery.yml            # NestJS API
npx artillery run infra/load-test/artillery-ai-service.yml # FastAPI AI servisi
```

## Bu Ajan Tarafından Bizzat Çalıştırılan Gerçek Sonuçlar

### NestJS API (`/`, `/tracks`, `/jobs/:id`)

- Toplam istek: **8550** (3 aşama: 5→20→50 istek/sn, toplam 2 dakika)
- **0 başarısız VU** (vuser)
- Yanıt süresi: ortalama 0.6ms, **p95 = 1ms, p99 = 2ms**
- `/` → 200 (beklendiği gibi), `/tracks` ve `/jobs/:id` → 401 (guard'ın kimlik doğrulaması olmadan doğru şekilde reddettiğini kanıtlıyor)

### FastAPI AI Servisi (`/health`)

- Toplam istek: **1050** (2 aşama: 5→15 istek/sn, 90 saniye)
- **0 başarısız VU**
- Yanıt süresi: ortalama 2.6ms, **p95 = 3ms, p99 = 4ms**

## Sınırlama: Ağır Uç Noktalar Test Edilemedi

`/uploads` (tus), `/separate` (Demucs), `/chords`, `/tempo`, `/transform` gibi asıl ağır/AI işlem yapan uç noktalar bu ortamda yük testine tabi tutulamadı çünkü:
1. Gerçek bir Supabase Storage/Postgres olmadan bu uç noktalar zaten hata veriyor (bkz. Stage 3-6 handoff'ları).
2. Demucs/SoundTouch gibi CPU-yoğun işlemlerin eşzamanlı yükü, gerçek donanımda (özellikle ücretsiz/paylaşımlı CPU hosting'de) çok farklı davranabilir — yerel geliştirme makinesinde ölçülen sayılar üretim ortamını temsil etmez.

**Bir sonraki ajan / proje sahibi**, gerçek Supabase+Upstash+deploy edilmiş ai-service ile şu senaryoyu test etmeli: `MAX_CONCURRENT_JOBS` sınırının aşıldığı durumda kuyruğun (BullMQ) davranışı, ve eşzamanlı 3-5 stem-ayırma isteğinin ücretsiz CPU hosting'de ne kadar sürdüğü/kuyruklandığı (Bölüm 9.1'de zaten öngörülen risk).
