"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@woodshed/ui";
import { createClient } from "@/lib/supabase/client";
import { usePlaylistTracks } from "@/lib/playlists/usePlaylistTracks";

interface UserTrack {
  id: string;
  title: string;
  artist?: string | null;
  tags?: string[];
  duration_seconds: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const { playlistId } = use(params);
  const { entries, loading, addTrack, removeTrack, move } = usePlaylistTracks(playlistId);

  const [allTracks, setAllTracks] = useState<UserTrack[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadTracks() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiUrl}/tracks`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        setAllTracks((await response.json()) as UserTrack[]);
      }
    }
    void loadTracks();
  }, []);

  const addedIds = new Set(entries.map((e) => e.trackId));
  const filtered = allTracks.filter((t) => {
    if (addedIds.has(t.id)) return false;
    if (!search.trim()) return true;
    const haystack = `${t.title} ${t.artist ?? ""} ${(t.tags ?? []).join(" ")}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <Link href="/playlists" className="text-sm text-indigo-600 hover:underline">
        ← Çalma Listelerim
      </Link>

      <h1 className="text-2xl font-semibold">Parçalar</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Yükleniyor…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">Bu listede henüz parça yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={entry.trackId}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
            >
              <div>
                <Link href={`/tracks/${entry.trackId}`} className="font-medium hover:underline">
                  {entry.title}
                </Link>
                {entry.artist && <span className="ml-2 text-sm text-gray-500">{entry.artist}</span>}
                <span className="ml-2 text-sm text-gray-400">
                  {formatDuration(entry.durationSeconds)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => void move(entry.trackId, "up")}
                  className="text-sm text-gray-500 disabled:opacity-30"
                  aria-label="Yukarı taşı"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === entries.length - 1}
                  onClick={() => void move(entry.trackId, "down")}
                  className="text-sm text-gray-500 disabled:opacity-30"
                  aria-label="Aşağı taşı"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => void removeTrack(entry.trackId)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Kaldır
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">Parça Ekle</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Parça adı, sanatçı veya etiket ara…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <ul className="flex flex-col gap-2">
          {filtered.map((track) => (
            <li key={track.id} className="flex items-center justify-between text-sm">
              <span>
                {track.title}
                {track.artist && <span className="ml-2 text-gray-500">{track.artist}</span>}
              </span>
              <Button onClick={() => void addTrack(track.id)} className="px-2 py-1 text-xs">
                Ekle
              </Button>
            </li>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400">Eklenecek parça bulunamadı.</p>
          )}
        </ul>
      </section>
    </main>
  );
}
