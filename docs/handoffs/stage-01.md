# Stage 01 — Proje Altyapısı ve DevOps

**Ajan:** 1 (Proje Altyapısı ve DevOps)
**Durum:** Tamamlandı (yerel doğrulama). Gerçek bulut hesapları (Vercel/Supabase/Upstash) proje sahibi tarafından oluşturulmalı — bkz. "Bir Sonraki Ajana Notlar".

## Ne İnşa Edildi

- pnpm workspaces monorepo iskeleti (`pnpm-workspace.yaml`, kök `package.json`).
- `apps/web`: Next.js 16 (App Router, TypeScript, Tailwind CSS 4, ESLint) — `create-next-app` ile scaffold edildi.
- `apps/api`: NestJS 11 (TypeScript) — `@nestjs/cli` ile scaffold edildi. `main.ts` CORS ayarı `WEB_APP_ORIGIN` env değişkenini okuyacak şekilde düzenlendi, varsayılan port 3001.
- `apps/ai-service`: FastAPI + Python 3.14 (venv ile test edildi, hedef runtime 3.11 olarak pyproject/CI'da sabitlendi). `/health` endpoint'i ve pytest testi mevcut. `Dockerfile` + `.dockerignore` eklendi (Render/Fly.io/HF Spaces uyumlu).
- `packages/shared-types`: Ortak TS tipleri (`StemJob`, `ChordSegment`, `StemPaths`, `JobStatus`) — Bölüm 11'deki job sözleşmesine göre.
- `packages/ui`: Paylaşılan React bileşenleri için iskelet (örnek `Button` bileşeni).
- ESLint + Prettier (Node tarafı), Ruff + Black + mypy (Python tarafı) yapılandırıldı.
- Husky + lint-staged pre-commit hook'u kuruldu (`.husky/pre-commit`).
- GitHub Actions CI (`.github/workflows/ci.yml`): `node` job'u (pnpm install/lint/test/build) ve `ai-service` job'u (ruff/black/pytest) ayrı ayrı çalışıyor; her PR ve `main` push'unda tetiklenir.
- `.env.example` dosyaları: `apps/web`, `apps/api`, `apps/ai-service`.
- Kök `README.md`, `/docs` klasör iskeleti (`handoffs`, `bug-reports`, `security`).

## Ortaya Çıkan API Uç Noktaları / Şemalar

- `GET /health` (ai-service) → `{ "status": "ok" }`
- NestJS `api` şu an sadece scaffold seviyesinde (`GET /` → "Hello World"); gerçek uç noktalar Ajan 2'den itibaren eklenecek.
- `packages/shared-types/src/index.ts`: `StemJob`, `StemJobInput`, `StemJobOutput`, `StemPaths`, `ChordSegment`, `JobStatus` tipleri — Ajan 3/4/5 bu tipleri genişletip kullanmalı.

## Gerekli Ortam Değişkenleri (isim + açıklama, değer yok)

**apps/web/.env.example**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase proje URL'i (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `NEXT_PUBLIC_API_URL` — NestJS API'nin base URL'i

**apps/api/.env.example**
- `PORT` — API'nin dinleyeceği port (varsayılan 3001)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — server-side Supabase erişimi
- `DATABASE_URL` — Postgres bağlantı dizesi (Supabase)
- `REDIS_URL` — Upstash Redis bağlantı dizesi (BullMQ için)
- `AI_SERVICE_URL` — FastAPI servisinin base URL'i
- `WEB_APP_ORIGIN` — CORS için izin verilen frontend origin'i

**apps/ai-service/.env.example**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Storage/DB erişimi
- `REDIS_URL` — BullMQ worker bağlantısı
- `MAX_CONCURRENT_JOBS` — Aynı anda işlenecek maksimum stem-separation işi (ücretsiz CPU kaynak sınırı)

## Yerelde Nasıl Çalıştırılır / Test Edilir

```bash
pnpm install
pnpm dev:web     # http://localhost:3000
pnpm dev:api     # http://localhost:3001

cd apps/ai-service
python -m venv .venv && ./.venv/Scripts/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload   # http://localhost:8000

# Kalite kontrolleri
pnpm lint && pnpm test && pnpm build
cd apps/ai-service && ruff check . && black --check . && pytest -q
```

Tüm bu komutlar bu ajan tarafından yerel ortamda çalıştırılıp doğrulandı (build/lint/test yeşil).

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Bulut hesapları henüz oluşturulmadı.** Vercel, Supabase, Upstash, Render/Fly.io/HF Spaces hesapları tarayıcı üzerinden OAuth/kayıt gerektirdiği için otomatik ajan tarafından oluşturulamaz. Proje sahibinin şu hesapları açıp API anahtarlarını ilgili `.env` dosyalarına eklemesi gerekiyor:
  - Vercel (apps/web deploy)
  - Supabase (Postgres + Auth + Storage + Realtime)
  - Upstash (Redis)
  - Render veya Fly.io veya Hugging Face Spaces (ai-service deploy)
  - GitHub repo (uzak repo henüz push edilmedi — sadece yerel git repo var)
- CI workflow (`ci.yml`) bir GitHub remote'a push edilmeden çalışmaz; içerik hazır, sadece tetiklenmeyi bekliyor.
- `apps/web`'de henüz test framework'ü (Jest/Playwright) kurulmadı — sayfa içeriği olmadığı için erken kurulum gereksiz görüldü; Ajan 7 (oynatıcı arayüzü) gerçek bileşenler eklerken test altyapısını da kurmalı.
- Python runtime yerelde 3.14 ile test edildi; CI ve `pyproject.toml` 3.11 hedefliyor (Demucs/librosa gibi ağır ML kütüphaneleri 3.11/3.12 ile daha iyi paket desteğine sahip) — Ajan 4/5/6 gerçek ML bağımlılıklarını eklerken Python sürümünü doğrulamalı.
- `packages/ui` ve `packages/shared-types` şu an minimal placeholder; gerçek içerik ilerleyen ajanlarca doldurulacak.
- **Pre-commit hook (husky/lint-staged) kapsamı bilinçli olarak sadece TS/JS (web+api) ile sınırlı tutuldu.** `ruff`/`black` global PATH'te değil (yalnızca `apps/ai-service/.venv` içinde) ve venv yolu (Windows'ta `Scripts/`, Unix'te `bin/`) platforma göre değiştiği için pre-commit hook'una taşınabilir şekilde eklenemedi. Python kalite kapısı `ci.yml`'deki `ai-service` job'u tarafından her PR'da zaten uygulanıyor (bkz. Bölüm 6.4). İstenirse ileride `pre-commit` (Python) framework'üyle çözülebilir.
- Supabase RLS politikaları, Auth entegrasyonu vb. henüz yok — Ajan 2'nin kapsamında.
