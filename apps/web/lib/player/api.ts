import type { ChordSegment, StemName } from "./types";

export interface TrackDetail {
  id: string;
  title: string;
  durationSeconds: number | null;
  createdAt: string;
  rawUrl: string | null;
  job: {
    status: "pending" | "processing" | "done" | "failed";
    error: string | null;
    chords: ChordSegment[];
    bpm: number | null;
    key: string | null;
    stems?: Partial<Record<StemName, string | null>>;
    stemPaths?: Partial<Record<StemName, string>>;
  } | null;
}

export async function fetchTrack(
  accessToken: string,
  trackId: string,
): Promise<TrackDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const response = await fetch(`${apiUrl}/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json()) as TrackDetail;
}
