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

### FFmpeg (LGPL derleme — apps/api)

`apps/api` dosya normalizasyonu için FFmpeg'e ihtiyaç duyar (Stage 03). **Bölüm 9.2 gereği yalnızca LGPL derlemesi kullanılmalı** (GPL bileşenler — libx264/libx265/librubberband — dahil eden derlemeler kapalı kaynak ticari kullanımla uyumsuzdur). Önerilen kaynak: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) "`*-lgpl*`" varyantı (Windows: `win64-lgpl`, Linux: `linux64-lgpl`). İndirip `apps/api/.env`'de `FFMPEG_PATH`/`FFPROBE_PATH` ile binary yolunu belirtin.

### SoundTouch (LGPL v2.1 — apps/ai-service)

Tempo/ton değiştirme (Stage 06) için SoundTouch'ın `soundstretch` CLI aracına ihtiyaç var. Windows için hazır derleme: [surina.net/soundtouch](https://www.surina.net/soundtouch/download.html) ("SoundStretch" — DLL değil, CLI). Linux için kaynak kodundan derlenmeli ([codeberg.org/soundtouch/soundtouch](https://codeberg.org/soundtouch/soundtouch)). İndirip `apps/ai-service/.env`'de `SOUNDSTRETCH_PATH` ile binary yolunu belirtin.

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
