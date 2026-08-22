import Link from "next/link";
import { Button } from "@woodshed/ui";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Hesap Oluştur</h1>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Ad Soyad
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          E-posta
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Şifre
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <p className="text-xs text-gray-500">
          Kayıt olarak{" "}
          <Link href="/legal/terms" className="underline">
            Kullanım Şartları
          </Link>{" "}
          ve{" "}
          <Link href="/legal/privacy" className="underline">
            Gizlilik Politikası
          </Link>
          &apos;nı kabul etmiş olursunuz.
        </p>

        <Button type="submit">Hesap Oluştur</Button>
      </form>

      <Link href="/login" className="text-sm text-indigo-600 hover:underline">
        Zaten hesabın var mı? Giriş yap
      </Link>
    </main>
  );
}
