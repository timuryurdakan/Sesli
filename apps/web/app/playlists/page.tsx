"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@woodshed/ui";
import { usePlaylists } from "@/lib/playlists/usePlaylists";

export default function PlaylistsPage() {
  const { playlists, loading, createPlaylist, deletePlaylist } = usePlaylists();
  const [newName, setNewName] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createPlaylist(newName.trim());
    setNewName("");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Çalma Listelerim</h1>

      <form onSubmit={(e) => void handleCreate(e)} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yeni çalma listesi adı"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <Button type="submit">Oluştur</Button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Yükleniyor…</p>
      ) : playlists.length === 0 ? (
        <p className="text-sm text-gray-500">Henüz çalma listeniz yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {playlists.map((playlist) => (
            <li
              key={playlist.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
            >
              <Link href={`/playlists/${playlist.id}`} className="font-medium hover:underline">
                {playlist.name}
              </Link>
              <button
                type="button"
                onClick={() => void deletePlaylist(playlist.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
