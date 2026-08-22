import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    title: "Yapay Zeka ile Ses Ayırma",
    desc: "Vokal, davul, bas, gitar, piyano — tek tıkla 6 kanala ayrılır.",
  },
  {
    title: "Akıllı Akor Tespiti",
    desc: "Şarkının akorları otomatik tespit edilip anlık gösterilir.",
  },
  {
    title: "Tempo ve Ton Değiştirme",
    desc: "Kalite kaybı olmadan hızlandır, yavaşlat, transpoze et.",
  },
  {
    title: "Senkronize Prova Modu",
    desc: "Aynı hesaba bağlı cihazlar arasında gerçek zamanlı ortak görüntüleme.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4">
        <h1 className="text-2xl font-semibold">Tekrar hoş geldin!</h1>
        <p className="text-gray-600">Devam etmek için:</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/upload"
            className="flex-1 rounded-md bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white"
          >
            Yeni Şarkı Yükle
          </Link>
          <Link
            href="/playlists"
            className="flex-1 rounded-md bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-700"
          >
            Çalma Listelerim
          </Link>
        </div>
        <Link href="/help" className="text-sm text-indigo-600 hover:underline">
          Yardım ve SSS
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-4xl font-bold">Woodshed AI</h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          Müzisyenler için yapay zeka destekli ses ayırma ve pratik platformu. Herhangi bir şarkıyı
          yükle, saniyeler içinde vokal/davul/bas/gitar/piyano kanallarına ayır, akorlarını gör,
          temposunu/tonunu değiştir.
        </p>
        <div className="mx-auto flex gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white"
          >
            Ücretsiz Başla
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700"
          >
            Giriş Yap
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-md border border-gray-200 p-4">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-400">
        <Link href="/help" className="hover:underline">
          Yardım ve SSS
        </Link>
        {" · "}
        <Link href="/legal/terms" className="hover:underline">
          Kullanım Şartları
        </Link>
        {" · "}
        <Link href="/legal/privacy" className="hover:underline">
          Gizlilik Politikası
        </Link>
      </p>
    </main>
  );
}
