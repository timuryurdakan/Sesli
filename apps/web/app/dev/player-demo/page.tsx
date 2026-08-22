import { PlayerView } from "@/components/player/PlayerView";
import type { TrackDetail } from "@/lib/player/api";

/**
 * Yalnızca geliştirme/manuel test amaçlı: gerçek bir Supabase job'ı olmadan
 * PlayerView'i tarayıcıda test edebilmek için sahte veri + yerel örnek ses
 * dosyaları (`public/demo/*.wav`) kullanır. Kimlik doğrulama gerektirmez.
 * Bkz. docs/handoffs/stage-07.md.
 */
const DEMO_TRACK: TrackDetail = {
  id: "demo",
  title: "Demo Şarkı (yerel test dosyaları)",
  durationSeconds: 8,
  createdAt: new Date().toISOString(),
  rawUrl: "/demo/mix.wav",
  job: {
    status: "done",
    error: null,
    bpm: 120,
    key: "A minor",
    chords: [
      { start: 0, end: 2, chord: "Am" },
      { start: 2, end: 4, chord: "F" },
      { start: 4, end: 6, chord: "C" },
      { start: 6, end: 8, chord: "G" },
    ],
    stems: {
      vocals: "/demo/vocals.wav",
      drums: "/demo/drums.wav",
      bass: "/demo/bass.wav",
      guitar: "/demo/guitar.wav",
      piano: "/demo/piano.wav",
      other: "/demo/other.wav",
    },
    stemPaths: {
      vocals: "demo/vocals.wav",
      drums: "demo/drums.wav",
      bass: "demo/bass.wav",
      guitar: "demo/guitar.wav",
      piano: "demo/piano.wav",
      other: "demo/other.wav",
    },
  },
};

export default function PlayerDemoPage() {
  return <PlayerView track={DEMO_TRACK} />;
}
