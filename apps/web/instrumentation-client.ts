import * as Sentry from "@sentry/nextjs";

// Bölüm 7 Ajan 10: tarayıcı tarafı hata izleme. DSN tanımlı değilse SDK
// sessizce no-op olur (yerel geliştirmede veya Sentry hesabı henüz
// oluşturulmamışken uygulama normal çalışmaya devam eder).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
