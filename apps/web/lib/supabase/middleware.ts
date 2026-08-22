import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/account", "/projects", "/practice", "/tracks", "/upload", "/playlists"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase henüz yapılandırılmamışsa (ör. yerel geliştirme, Stage 01/02
  // handoff'larındaki bilinen sınırlama) oturum kontrolünü atla — auth
  // gerektirmeyen sayfalar yine de açılabilsin.
  //
  // ÜRETİMDE bu "fail-open" olamaz (Ajan 12 Yüksek #3): env değişkenleri bir
  // deploy/secret hatasıyla kaybolursa korumalı yollar sessizce herkese açık
  // kalmamalı. Bu yüzden production'da korumalı bir yol istenirse
  // fail-closed davranılır (login'e yönlendirilir) — geliştirmede ise eski
  // davranış (sayfa oturumsuz açılır) korunur.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
      if (isProtected) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
