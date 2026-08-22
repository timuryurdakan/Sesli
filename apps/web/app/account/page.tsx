import { redirect } from "next/navigation";
import { Button } from "@woodshed/ui";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, logout, deleteAccount } from "./actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { error, updated } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, instrument")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold">Hesap Ayarları</h1>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {updated && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Profil güncellendi.
        </p>
      )}

      <form action={updateProfile} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Ad Soyad
          <input
            type="text"
            name="fullName"
            defaultValue={profile?.full_name ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Enstrüman Tercihi
          <select
            name="instrument"
            defaultValue={profile?.instrument ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Seçiniz</option>
            <option value="guitar">Gitar</option>
            <option value="bass">Bas</option>
            <option value="piano">Piyano</option>
            <option value="drums">Davul</option>
            <option value="vocals">Vokal</option>
            <option value="other">Diğer</option>
          </select>
        </label>

        <Button type="submit">Profili Güncelle</Button>
      </form>

      <form action={logout}>
        <Button
          type="submit"
          className="w-full bg-white !text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          Çıkış Yap
        </Button>
      </form>

      <form action={deleteAccount} className="border-t border-gray-200 pt-6">
        <p className="mb-2 text-sm text-gray-500">
          Hesabını ve tüm verilerini kalıcı olarak sil (KVKK/GDPR &quot;unutulma hakkı&quot;).
        </p>
        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
          Hesabı Sil
        </Button>
      </form>
    </main>
  );
}
