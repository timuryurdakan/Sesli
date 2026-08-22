"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface PlaylistRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Özellik 7 (bulut senkronizasyonu): playlist CRUD'u doğrudan Supabase
 * istemcisi (anon key + kullanıcı oturumu) üzerinden yapılır, NestJS API
 * proxy'si üzerinden değil — bu sayede Postgres Realtime + RLS "bedava"
 * gelir (bkz. docs/handoffs/stage-08.md mimari kararı).
 */
export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("playlists")
      .select("id, name, created_at, updated_at")
      .order("created_at", { ascending: false })
      .returns<PlaylistRow[]>();

    setPlaylists(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // Mount'ta ilk yükleme + Realtime aboneliğiyle güncelleme — "refresh"
    // zaten async ve setState'i bir mikrotask sonrasında çağırıyor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const supabase = createClient();
    const channel = supabase
      .channel("playlists-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const createPlaylist = useCallback(async (name: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("playlists").insert({ user_id: user.id, name });
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const supabase = createClient();
    await supabase.from("playlists").update({ name }).eq("id", id);
  }, []);

  const deletePlaylist = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("playlists").delete().eq("id", id);
  }, []);

  return { playlists, loading, createPlaylist, renamePlaylist, deletePlaylist };
}
