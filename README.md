# Woodshed AI

Müzisyenler için yapay zeka destekli ses ayırma & pratik platformu. Bkz. [`docs/woodshed-ai-proje-plani.md`](./docs/woodshed-ai-proje-plani.md) tam PRD ve yapım planı için.

## Monorepo Yapısı

```
/apps
  /web            Next.js PWA (frontend)
  /api            NestJS ana backend
  /ai-service     FastAPI yapay zeka mikroservisi
/packages
  /shared-types   Ortak TypeScript tip tanımları
  /ui             Paylaşılan UI bileşenleri
/docs
  /handoffs       Her aşamanın devir dokümanı
  /bug-reports    Bug Avcısı ajanı çıktıları
  /security       Güvenlik Denetçisi ajanı çıktıları
/infra            Deployment notları
```

## Gereksinimler

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Python 3.11+

## Kurulum

```bash
pnpm install

# ai-service için ayrı Python sanal ortamı
cd apps/ai-service
python -m venv .venv
./.venv/Scripts/activate   # Windows
pip install -r requirements-dev.txt
```

Her uygulamanın `.env.example` dosyasını `.env` olarak kopyalayıp değerleri doldurun (`apps/web`, `apps/api`, `apps/ai-service`).

## Geliştirme

```bash
pnpm dev:web    # Next.js dev server (http://localhost:3000)
pnpm dev:api    # NestJS dev server (http://localhost:3001)

# ai-service (venv aktifken)
cd apps/ai-service && uvicorn app.main:app --reload
```

## Lint / Test / Build

```bash
pnpm lint
pnpm test
pnpm build

# ai-service
cd apps/ai-service
ruff check . && black --check . && pytest -q
```

## CI/CD

`.github/workflows/ci.yml` her PR ve `main` push'unda lint+test+build çalıştırır (Node tarafı ve Python/ai-service tarafı ayrı job olarak).

## Deployment (ücretsiz katman)

| Uygulama | Hedef | Not |
|---|---|---|
| `apps/web` | Vercel | Repo bağlanırken "Root Directory" = `apps/web` seçilmeli |
| `apps/api` | Render / Fly.io | Root Directory = `apps/api`, build: `pnpm install && pnpm build`, start: `node dist/main.js` |
| `apps/ai-service` | Render / Fly.io / HF Spaces | `apps/ai-service/Dockerfile` kullanılabilir |
| DB/Auth/Storage/Realtime | Supabase | Ücretsiz proje oluşturulmalı |
| İş kuyruğu | Upstash Redis | Ücretsiz Redis instance |

Bu servislerin hesap oluşturma/bağlama adımları (Vercel, Supabase, Upstash, Render) tarayıcı üzerinden giriş gerektirdiği için proje sahibi tarafından yapılmalı; API anahtarları elde edildikten sonra ilgili `.env` dosyalarına eklenmelidir.
