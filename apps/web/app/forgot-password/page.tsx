import Link from "next/link";
import { Button } from "@woodshed/ui";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Şifremi Unuttum</h1>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
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

        <Button type="submit">Sıfırlama Bağlantısı Gönder</Button>
      </form>

      <Link href="/login" className="text-sm text-indigo-600 hover:underline">
        Girişe dön
      </Link>
    </main>
  );
}
