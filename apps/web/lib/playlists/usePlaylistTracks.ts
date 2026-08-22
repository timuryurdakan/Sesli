"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PlaylistTrackEntry {
  trackId: string;
  position: number;
  title: string;
  artist: string | null;
  durationSeconds: number | null;
}

interface PlaylistTrackRow {
  track_id: string;
  position: number;
  tracks: { title: string; artist: string | null; duration_seconds: number | null } | null;
}

export function usePlaylistTracks(playlistId: string) {
  const [entries, setEntries] = useState<PlaylistTrackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("playlist_tracks")
      .select("track_id, position, tracks(title, artist, duration_seconds)")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true })
      .returns<PlaylistTrackRow[]>();

    setEntries(
      (data ?? []).map((row) => ({
        trackId: row.track_id,
        position: row.position,
        title: row.tracks?.title ?? "(bilinmeyen parça)",
        artist: row.tracks?.artist ?? null,
        durationSeconds: row.tracks?.duration_seconds ?? null,
      })),
    );
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    // Mount'ta ilk yükleme + Realtime aboneliğiyle güncelleme — "refresh"
    // zaten async ve setState'i bir mikrotask sonrasında çağırıyor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const supabase = createClient();
    const channel = supabase
      .channel(`playlist-tracks-${playlistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playlist_tracks",
          filter: `playlist_id=eq.${playlistId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [playlistId, refresh]);

  const addTrack = useCallback(
    async (trackId: string) => {
      const supabase = createClient();
      await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: playlistId, track_id: trackId, position: entries.length });
    },
    [playlistId, entries.length],
  );

  const removeTrack = useCallback(
    async (trackId: string) => {
      const supabase = createClient();
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);
    },
    [playlistId],
  );

  const move = useCallback(
    async (trackId: string, direction: "up" | "down") => {
      const index = entries.findIndex((e) => e.trackId === trackId);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= entries.length) return;

      const supabase = createClient();
      const current = entries[index];
      const swapWith = entries[swapIndex];

      await Promise.all([
        supabase
          .from("playlist_tracks")
          .update({ position: swapWith.position })
          .eq("playlist_id", playlistId)
          .eq("track_id", current.trackId),
        supabase
          .from("playlist_tracks")
          .update({ position: current.position })
          .eq("playlist_id", playlistId)
          .eq("track_id", swapWith.trackId),
      ]);
    },
    [entries, playlistId],
  );

  return { entries, loading, addTrack, removeTrack, move };
}
