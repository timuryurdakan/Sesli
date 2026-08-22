"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { currentChordIndexFor } from "@/lib/player/chords";
import type { ChordSegment } from "@/lib/player/types";

const BROADCAST_THROTTLE_MS = 300; // >1/sn güncelleme — Bölüm 7 Ajan 9 DoD: <1sn gecikme
const DRIFT_RESYNC_THRESHOLD_SECONDS = 0.75;

interface PracticeStatePayload {
  trackId: string;
  position: number;
  isPlaying: boolean;
  currentChordIndex: number;
  hostDeviceId: string;
  updatedAt: number;
}

export interface PracticeEngineAdapter {
  currentTime: number;
  isPlaying: boolean;
  seekTo: (time: number) => void;
  playPause: () => void;
  play: () => void;
  pause: () => void;
}

/**
 * Özellik 8 (Senkronize Prova Modu, Bölüm 7 Ajan 9): Supabase Realtime'ın
 * "private" Broadcast kanalları üzerinden çoklu cihaz senkronizasyonu.
 * Kanal `practice-{userId}` biçimindedir; yalnızca aynı kullanıcının
 * (JWT'si geçerli) cihazları erişebilir — bkz.
 * supabase/migrations/0005_practice_session_realtime_auth.sql.
 *
 * Lider/takipçi modeli: bir cihaz "Bu Cihazdan Yönet" ile kontrolü alır
 * (host-claim yayını); o andan itibaren yalnızca o cihaz `playback-state`
 * yayınlar, diğerleri (takipçiler) kendi motorlarını gelen yayına göre
 * pasif olarak sürer.
 */
export function usePracticeSession(
  trackId: string,
  chords: ChordSegment[],
  engine: PracticeEngineAdapter,
) {
  const [deviceId] = useState(() => crypto.randomUUID());
  const [hostDeviceId, setHostDeviceId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef(0);
  const prevIsPlayingRef = useRef(engine.isPlaying);
  const isHost = hostDeviceId === deviceId;
  const engineRef = useRef(engine);
  const isHostRef = useRef(isHost);
  const chordsRef = useRef(chords);

  useLayoutEffect(() => {
    engineRef.current = engine;
    isHostRef.current = isHost;
    chordsRef.current = chords;
  });

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      await supabase.realtime.setAuth();

      const channel = supabase.channel(`practice-${user.id}`, {
        config: { private: true, broadcast: { self: false } },
      });

      channel
        .on(
          "broadcast",
          { event: "playback-state" },
          ({ payload }: { payload: PracticeStatePayload }) => {
            if (payload.trackId !== trackId) return;
            setHostDeviceId(payload.hostDeviceId);
            // Biz host isek (veya host olarak anons edilen biziz), kendi
            // durumumuzu takip etmeyiz — yalnızca takipçiler uygular.
            if (payload.hostDeviceId === deviceId) return;

            const current = engineRef.current;
            if (Math.abs(current.currentTime - payload.position) > DRIFT_RESYNC_THRESHOLD_SECONDS) {
              current.seekTo(payload.position);
            }
            if (payload.isPlaying && !current.isPlaying) current.play();
            if (!payload.isPlaying && current.isPlaying) current.pause();
          },
        )
        .on(
          "broadcast",
          { event: "host-claim" },
          ({ payload }: { payload: { hostDeviceId: string } }) => {
            setHostDeviceId(payload.hostDeviceId);
          },
        )
        .on("broadcast", { event: "request-state" }, () => {
          if (isHostRef.current) broadcastState();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnected(true);
            void channel.send({
              type: "broadcast",
              event: "request-state",
              payload: {},
            });
          }
          if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnected(false);
          }
        });

      channelRef.current = channel;
    }

    function broadcastState() {
      const current = engineRef.current;
      void channelRef.current?.send({
        type: "broadcast",
        event: "playback-state",
        payload: {
          trackId,
          position: current.currentTime,
          isPlaying: current.isPlaying,
          currentChordIndex: currentChordIndexFor(chordsRef.current, current.currentTime),
          hostDeviceId: deviceId,
          updatedAt: Date.now(),
        } satisfies PracticeStatePayload,
      });
    }

    void connect();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        const supabase = createClient();
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [trackId, deviceId]);

  // Host iken kendi oynatma durumunu (throttled) yayınla.
  useEffect(() => {
    if (!isHost || !channelRef.current) return;

    const isPlayingChanged = prevIsPlayingRef.current !== engine.isPlaying;
    prevIsPlayingRef.current = engine.isPlaying;

    const now = Date.now();
    // isPlaying değişimleri (özellikle duraklatma) throttle penceresinde
    // asla kaybolmamalı: `currentTime` duraklatınca artık değişmediğinden bu
    // efekt bir daha tetiklenmez, dolayısıyla atlanan bir "duraklat" olayı
    // takipçilere sonsuza dek hiç ulaşmazdı (Ajan 11 Yüksek bulgusu). Bu
    // yüzden isPlaying değişimi throttle'ı bypass eder.
    if (!isPlayingChanged && now - lastBroadcastRef.current < BROADCAST_THROTTLE_MS) return;
    lastBroadcastRef.current = now;

    void channelRef.current.send({
      type: "broadcast",
      event: "playback-state",
      payload: {
        trackId,
        position: engine.currentTime,
        isPlaying: engine.isPlaying,
        currentChordIndex: currentChordIndexFor(chords, engine.currentTime),
        hostDeviceId: deviceId,
        updatedAt: now,
      } satisfies PracticeStatePayload,
    });
  }, [isHost, engine.currentTime, engine.isPlaying, trackId, deviceId, chords]);

  const claimHost = useCallback(() => {
    setHostDeviceId(deviceId);
    void channelRef.current?.send({
      type: "broadcast",
      event: "host-claim",
      payload: { hostDeviceId: deviceId },
    });
  }, [deviceId]);

  return {
    connected,
    isHost,
    hasHost: hostDeviceId !== null,
    isFollowing: hostDeviceId !== null && !isHost,
    claimHost,
  };
}
