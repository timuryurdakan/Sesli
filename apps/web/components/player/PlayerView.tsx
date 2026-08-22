"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerEngine } from "@/lib/player/usePlayerEngine";
import { usePracticeSession } from "@/lib/practice/usePracticeSession";
import { STEM_NAMES, type StemName } from "@/lib/player/types";
import { formatTime } from "@/lib/player/format";
import type { TrackDetail } from "@/lib/player/api";
import { MixerChannel } from "./MixerChannel";
import { ChordStrip } from "./ChordStrip";
import { LoopControls } from "./LoopControls";
import { TempoControls } from "./TempoControls";
import { PracticeSessionBar } from "./PracticeSessionBar";

const COUNT_IN_OPTIONS = [1, 2, 4, 8];

interface PlayerViewProps {
  track: TrackDetail;
}

export function PlayerView({ track }: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stemUrls, setStemUrls] = useState<Partial<Record<StemName, string>>>(() => {
    const entries = Object.entries(track.job?.stems ?? {}).filter(([, url]) => url != null) as [
      StemName,
      string,
    ][];
    return Object.fromEntries(entries);
  });
  const [countInBeats, setCountInBeats] = useState(4);

  const engine = usePlayerEngine(containerRef, {
    visualUrl: track.rawUrl ?? "",
    stemUrls,
    bpm: track.job?.bpm ?? null,
  });

  const practiceSession = usePracticeSession(track.id, track.job?.chords ?? [], engine);

  // `jobs` tablosu Realtime yayınına eklenmiş ama buna abone olmuyoruz;
  // yükleme sonrası kullanıcı sayfaya "processing" durumundayken düştüğünde
  // hiçbir şey bunu "done"a güncellemiyordu (Ajan 11 Yüksek bulgusu).
  // En basit/güvenilir düzeltme: iş bitene kadar birkaç saniyede bir sunucu
  // bileşenini (fetchTrack) yeniden çalıştır.
  const router = useRouter();
  const jobStatus = track.job?.status;
  useEffect(() => {
    if (jobStatus === "done" || jobStatus === "failed") return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [jobStatus, router]);

  if (!track.job || track.job.status !== "done") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{track.title}</h1>
        <p className="mt-4 text-gray-600">
          {track.job?.status === "failed"
            ? `İşleme başarısız oldu: ${track.job.error ?? "bilinmeyen hata"}`
            : "Parça işleniyor… (ayırma/akor/tempo analizleri sürüyor)"}
        </p>
      </main>
    );
  }

  const availableStems = STEM_NAMES.filter((name) => stemUrls[name]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{track.title}</h1>
        {track.job.key && <span className="text-sm text-gray-500">Ton: {track.job.key}</span>}
        {track.job.bpm && (
          <span className="text-sm text-gray-500">{Math.round(track.job.bpm)} BPM</span>
        )}
      </header>

      <ChordStrip chords={track.job.chords} currentTime={engine.currentTime} />

      <div ref={containerRef} className="w-full" data-testid="waveform" />

      <PracticeSessionBar
        connected={practiceSession.connected}
        isHost={practiceSession.isHost}
        isFollowing={practiceSession.isFollowing}
        onClaimHost={practiceSession.claimHost}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums text-sm text-gray-600">
          {formatTime(engine.currentTime)} / {formatTime(engine.duration)}
        </span>

        <button
          type="button"
          disabled={practiceSession.isFollowing}
          onClick={() =>
            engine.isPlaying ? engine.playPause() : engine.playWithCountIn(countInBeats)
          }
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {engine.isPlaying ? "Duraklat" : "Çal"}
        </button>

        <label className="flex items-center gap-1 text-sm">
          Geri sayım:
          <select
            value={countInBeats}
            disabled={practiceSession.isFollowing}
            onChange={(e) => setCountInBeats(Number(e.target.value))}
            className="rounded border border-gray-300 px-1 py-0.5"
          >
            {COUNT_IN_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} vuruş
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={engine.toggleMetronome}
          aria-pressed={engine.metronomeOn}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            engine.metronomeOn ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          Metronom {engine.metronomeOn ? "Açık" : "Kapalı"}
        </button>
      </div>

      <LoopControls loopRegion={engine.loopRegion} onClear={engine.clearLoop} />

      <section aria-label="Mikser" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {availableStems.map((name) => (
          <MixerChannel
            key={name}
            name={name}
            state={engine.mixer[name]}
            onChange={(state) => engine.setChannelState(name, state)}
          />
        ))}
      </section>

      {track.job.stemPaths && (
        <TempoControls
          stemStoragePaths={track.job.stemPaths}
          onTransformed={(newUrls) => {
            setStemUrls((prev) => ({ ...prev, ...newUrls }));
            engine.replaceStemSources(newUrls);
          }}
        />
      )}
    </main>
  );
}
