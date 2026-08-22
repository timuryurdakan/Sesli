import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase yapılandırılmamışsa (ör. yerel geliştirme) yer tutucu değerlerle
 * client'ı yine de oluşturuyoruz — aksi halde `createServerClient` senkron
 * olarak fırlatıp sunucu bileşenini 500'e düşürür (bkz. lib/supabase/client.ts
 * içindeki aynı düzeltme).
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component without a following response —
          // safe to ignore because middleware refreshes the session on every request.
        }
      },
    },
  });
}
