import Link from "next/link";
import { Button } from "@woodshed/ui";
import { login, loginWithGoogle } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Giriş Yap</h1>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/"} />

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
            autoComplete="current-password"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <Button type="submit">Giriş Yap</Button>
      </form>

      <form action={loginWithGoogle}>
        <Button
          type="submit"
          className="w-full bg-white !text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          Google ile Giriş Yap
        </Button>
      </form>

      <div className="flex justify-between text-sm">
        <Link href="/signup" className="text-indigo-600 hover:underline">
          Hesap oluştur
        </Link>
        <Link href="/forgot-password" className="text-indigo-600 hover:underline">
          Şifremi unuttum
        </Link>
      </div>
    </main>
  );
}
