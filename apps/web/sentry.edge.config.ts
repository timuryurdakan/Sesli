import * as Sentry from "@sentry/nextjs";

// Bölüm 7 Ajan 10: hata izleme (ücretsiz Sentry tier). DSN tanımlı değilse
// SDK sessizce no-op olur. Proxy (proxy.ts) varsayılan olarak Node.js
// runtime kullanıyor (Next.js 16), ama edge runtime seçilirse diye
// bu dosya da hazır tutuluyor.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});
