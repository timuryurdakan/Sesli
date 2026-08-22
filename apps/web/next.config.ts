import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@woodshed/ui", "@woodshed/shared-types"],
};

// Bölüm 7 Ajan 10: hata izleme. `org`/`project`/`authToken` (Sentry hesabı
// oluşturulduğunda) env değişkenleriyle verilmezse, plugin source map
// yüklemesini sessizce atlar — build'i bozmaz.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
