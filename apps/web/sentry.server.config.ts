import * as Sentry from "@sentry/nextjs";

// Bölüm 7 Ajan 10: hata izleme (ücretsiz Sentry tier). DSN tanımlı değilse
// SDK sessizce no-op olur.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});
