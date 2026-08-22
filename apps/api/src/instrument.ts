import * as Sentry from '@sentry/nestjs';

// Bölüm 7 Ajan 10: hata izleme (ücretsiz Sentry tier). `SENTRY_DSN`
// tanımlı değilse SDK sessizce no-op olur — yerel geliştirmede veya
// Sentry hesabı henüz oluşturulmamışken uygulama normal çalışmaya devam eder.
// Bu dosya main.ts'in EN BAŞINDA (diğer her importtan önce) import edilmelidir
// (Sentry'nin otomatik enstrümantasyonu için resmi gereksinim).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
});
