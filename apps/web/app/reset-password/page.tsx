import { Button } from "@woodshed/ui";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Yeni Şifre Belirle</h1>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={updatePassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Yeni Şifre
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <Button type="submit">Şifreyi Güncelle</Button>
      </form>
    </main>
  );
}
