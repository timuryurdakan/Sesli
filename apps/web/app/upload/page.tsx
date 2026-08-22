"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

type UploadState = "idle" | "uploading" | "processing" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("uploading");
    setProgress(0);
    setError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("Oturum bulunamadı, lütfen tekrar giriş yapın.");
      setState("error");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    const upload = new tus.Upload(file, {
      endpoint: `${apiUrl}/uploads`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: { Authorization: `Bearer ${session.access_token}` },
      metadata: { filename: file.name, filetype: file.type },
      onProgress(bytesSent, bytesTotal) {
        setProgress(Math.round((bytesSent / bytesTotal) * 100));
      },
      onSuccess(payload) {
        setState("processing");
        try {
          const body = payload.lastResponse.getBody();
          const { trackId } = JSON.parse(body) as { trackId: string };
          router.push(`/tracks/${trackId}`);
        } catch {
          setError("Yükleme tamamlandı ama parça bulunamadı.");
          setState("error");
        }
      },
      onError(err) {
        setError(err.message);
        setState("error");
      },
    });

    upload.start();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Şarkı Yükle</h1>

      {state === "idle" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Ses veya video dosyası seçin (mp3, wav, m4a, mp4)
          <input
            type="file"
            accept="audio/*,video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
      )}

      {state === "uploading" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">Yükleniyor… %{progress}</p>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {state === "processing" && (
        <p className="text-sm text-gray-600">
          Yükleme tamamlandı, parça işleniyor… Oynatıcı sayfasına yönlendiriliyorsunuz.
        </p>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </main>
  );
}
