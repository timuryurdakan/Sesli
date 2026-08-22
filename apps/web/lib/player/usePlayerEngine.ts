"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Metronome } from "./Metronome";
import { PlayerEngine } from "./PlayerEngine";
import {
  createDefaultMixerState,
  type ChannelState,
  type MixerState,
  type StemName,
} from "./types";

export interface UsePlayerEngineOptions {
  visualUrl: string;
  stemUrls: Partial<Record<StemName, string>>;
  bpm: number | null;
}

export function usePlayerEngine(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UsePlayerEngineOptions,
) {
  const engineRef = useRef<PlayerEngine | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [mixer, setMixer] = useState<MixerState>(createDefaultMixerState());
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null);
  const [metronomeOn, setMetronomeOn] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const engine = new PlayerEngine(
      { container: containerRef.current, visualUrl: options.visualUrl, stemUrls: options.stemUrls },
      createDefaultMixerState(),
    );
    engineRef.current = engine;

    const offPlay = engine.on("play", () => setIsPlaying(true));
    const offPause = engine.on("pause", () => setIsPlaying(false));
    const offTime = engine.on("timeupdate", () => setCurrentTime(engine.getCurrentTime()));
    const offLoop = engine.on("loop-change", () => setLoopRegion(engine.getLoopRegion()));
    const offReady = engine.on("ready", () => {
      setDuration(engine.getDuration());
      setReady(true);
    });

    return () => {
      offPlay();
      offPause();
      offTime();
      offLoop();
      offReady();
      engine.destroy();
      engineRef.current = null;
    };
    // Konteyner ve stem URL'leri değiştiğinde motor sıfırdan kurulmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.visualUrl, containerRef]);

  useEffect(() => {
    if (!options.bpm) return undefined;
    const metronome = new Metronome(options.bpm);
    metronomeRef.current = metronome;
    return () => metronome.destroy();
  }, [options.bpm]);

  useEffect(() => {
    metronomeRef.current?.setBpm(options.bpm ?? 120);
  }, [options.bpm]);

  const playPause = useCallback(() => engineRef.current?.playPause(), []);
  const play = useCallback(() => engineRef.current?.play(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const seekTo = useCallback((time: number) => engineRef.current?.seekTo(time), []);

  const playWithCountIn = useCallback((beats = 4) => {
    if (!metronomeRef.current) {
      engineRef.current?.play();
      return;
    }
    metronomeRef.current.countIn(beats, () => engineRef.current?.play());
  }, []);

  const setChannelState = useCallback((name: StemName, state: Partial<ChannelState>) => {
    engineRef.current?.setChannelState(name, state);
    setMixer((prev) => ({ ...prev, [name]: { ...prev[name], ...state } }));
  }, []);

  const setLoop = useCallback((start: number, end: number) => {
    engineRef.current?.addLoopRegion(start, end);
    setLoopRegion({ start, end });
  }, []);

  const clearLoop = useCallback(() => {
    engineRef.current?.clearLoop();
    setLoopRegion(null);
  }, []);

  const toggleMetronome = useCallback(() => {
    setMetronomeOn((wasOn) => {
      if (wasOn) {
        metronomeRef.current?.stop();
      } else {
        metronomeRef.current?.start();
      }
      return !wasOn;
    });
  }, []);

  const replaceStemSources = useCallback((newUrls: Partial<Record<StemName, string>>) => {
    engineRef.current?.replaceStemSources(newUrls);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    ready,
    mixer,
    loopRegion,
    metronomeOn,
    playPause,
    play,
    pause,
    seekTo,
    playWithCountIn,
    setChannelState,
    setLoop,
    clearLoop,
    toggleMetronome,
    replaceStemSources,
  };
}
