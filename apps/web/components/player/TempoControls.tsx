"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StemName } from "@/lib/player/types";

interface TempoControlsProps {
  stemStoragePaths: Partial<Record<StemName, string>>;
  onTransformed: (newUrls: Partial<Record<StemName, string>>) => void;
}

/**
 * Özellik 3 (tempo) ve Özellik 4 (ton). Kullanıcı sürgüyü bırakıp
 * "Uygula"ya bastığında, her stem için apps/api'nin `/transform` proxy'si
 * (Ajan 6'nın SoundTouch motoru) çağrılır ve oynatıcıdaki kaynaklar
 * değiştirilir. Her hareket değil, yalnızca "Uygula" backend'i tetikler.
 */
export function TempoControls({ stemStoragePaths, onTransformed }: TempoControlsProps) {
  const [tempoPercent, setTempoPercent] = useState(0);
  const [semitones, setSemitones] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setIsApplying(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Oturum bulunamadı");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const entries = Object.entries(stemStoragePaths) as [StemName, string][];

      const results = await Promise.all(
        entries.map(async ([name, storagePath]) => {
          const response = await fetch(`${apiUrl}/transform`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ storagePath, tempoPercent, semitones }),
          });

          if (!response.ok) {
            throw new Error(`${name}: ${await response.text()}`);
          }

          const blob = await response.blob();
          return [name, URL.createObjectURL(blob)] as const;
        }),
      );

      onTransformed(Object.fromEntries(results));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dönüşüm başarısız oldu");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Tempo: {tempoPercent > 0 ? "+" : ""}
        {tempoPercent}%
        <input
          type="range"
          min={-50}
          max={50}
          value={tempoPercent}
          onChange={(e) => setTempoPercent(Number(e.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ton: {semitones > 0 ? "+" : ""}
        {semitones} yarım ses
        <input
          type="range"
          min={-12}
          max={12}
          value={semitones}
          onChange={(e) => setSemitones(Number(e.target.value))}
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void apply()}
        disabled={isApplying || (tempoPercent === 0 && semitones === 0)}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {isApplying ? "Uygulanıyor…" : "Uygula"}
      </button>
    </div>
  );
}
