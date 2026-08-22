import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase yapılandırılmamışsa (ör. yerel geliştirme, bkz. stage-01/02
 * handoff'ları) `createBrowserClient` boş string'lerle senkron olarak
 * fırlatır — bu da her çağıran bileşeni (login, upload, playlists, vb.)
 * çökertir. Yer tutucu değerlerle client'ı yine de oluşturuyoruz; gerçek
 * bir istek atıldığında ağ/auth hatası olarak zarifçe başarısız olur,
 * uygulamayı çökertmez.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(url, anonKey);
}
