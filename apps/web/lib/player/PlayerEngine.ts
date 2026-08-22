import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { STEM_NAMES, type ChannelState, type MixerState, type StemName } from "./types";

const DRIFT_CORRECTION_THRESHOLD_SECONDS = 0.05;

export interface PlayerEngineOptions {
  container: HTMLElement;
  /** Waveform'da görselleştirilecek referans ses (ör. orijinal karışım). Sessizdir — asıl ses stem'lerden gelir. */
  visualUrl: string;
  stemUrls: Partial<Record<StemName, string>>;
}

export type PlayerEngineEvent = "play" | "pause" | "timeupdate" | "ready" | "loop-change";

/**
 * 6 stem'i tek bir waveform'a (görsel/konum referansı) senkronize eden
 * oynatıcı motoru (Bölüm 7 Ajan 7). Waveform sessizdir; asıl ses her biri
 * bağımsız ses seviyesi/mute/solo'ya sahip <audio> elementlerinden gelir.
 * Senkronizasyon periyodik `currentTime` düzeltmesiyle sağlanır (bkz.
 * docs/handoffs/stage-07.md — araştırılan standart teknik).
 */
export class PlayerEngine {
  private wavesurfer: WaveSurfer;
  private regionsPlugin: RegionsPlugin;
  private stemAudio: Partial<Record<StemName, HTMLAudioElement>> = {};
  private mixer: MixerState;
  private loopRegion: Region | null = null;
  private listeners = new Map<PlayerEngineEvent, Set<() => void>>();

  constructor(options: PlayerEngineOptions, initialMixer: MixerState) {
    this.mixer = initialMixer;

    this.regionsPlugin = RegionsPlugin.create();

    this.wavesurfer = WaveSurfer.create({
      container: options.container,
      url: options.visualUrl,
      waveColor: "#a5b4fc",
      progressColor: "#4f46e5",
      height: 80,
      normalize: true,
      plugins: [this.regionsPlugin],
    });
    this.wavesurfer.setMuted(true);

    for (const name of STEM_NAMES) {
      const url = options.stemUrls[name];
      if (!url) continue;
      const audio = new Audio(url);
      audio.preload = "auto";
      this.applyChannelState(name, audio, this.mixer[name]);
      this.stemAudio[name] = audio;
    }

    this.wavesurfer.on("play", () => {
      this.syncStemsToWavesurfer(true);
      this.emit("play");
    });
    this.wavesurfer.on("pause", () => {
      for (const audio of Object.values(this.stemAudio)) audio?.pause();
      this.emit("pause");
    });
    this.wavesurfer.on("seeking", (time) => {
      this.seekStems(time);
    });
    this.wavesurfer.on("timeupdate", (time) => {
      this.correctDrift(time);
      this.checkLoopBoundary(time);
      this.emit("timeupdate");
    });
    this.wavesurfer.on("ready", () => this.emit("ready"));

    this.regionsPlugin.on("region-updated", (region) => {
      this.loopRegion = region;
      this.emit("loop-change");
    });

    this.regionsPlugin.on("region-created", (region) => {
      // Aynı anda yalnızca tek bir loop bölgesi desteklenir — waveform
      // üzerinde sürükleyerek yeni bir bölge oluşturmak öncekini değiştirir.
      for (const existing of this.regionsPlugin.getRegions()) {
        if (existing !== region) existing.remove();
      }
      this.loopRegion = region;
      this.emit("loop-change");
    });

    this.regionsPlugin.enableDragSelection({
      color: "rgba(79, 70, 229, 0.2)",
    });
  }

  private emit(event: PlayerEngineEvent): void {
    for (const cb of this.listeners.get(event) ?? []) cb();
  }

  on(event: PlayerEngineEvent, callback: () => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private syncStemsToWavesurfer(play: boolean): void {
    const time = this.wavesurfer.getCurrentTime();
    for (const audio of Object.values(this.stemAudio)) {
      if (!audio) continue;
      audio.currentTime = time;
      if (play) void audio.play();
    }
  }

  private seekStems(time: number): void {
    for (const audio of Object.values(this.stemAudio)) {
      if (audio) audio.currentTime = time;
    }
  }

  private correctDrift(referenceTime: number): void {
    for (const audio of Object.values(this.stemAudio)) {
      if (!audio || audio.paused) continue;
      if (Math.abs(audio.currentTime - referenceTime) > DRIFT_CORRECTION_THRESHOLD_SECONDS) {
        audio.currentTime = referenceTime;
      }
    }
  }

  private checkLoopBoundary(time: number): void {
    if (!this.loopRegion) return;
    if (time >= this.loopRegion.end) {
      this.wavesurfer.setTime(this.loopRegion.start);
    }
  }

  private applyChannelState(name: StemName, audio: HTMLAudioElement, state: ChannelState): void {
    const anySoloed = Object.values(this.mixer).some((c) => c.solo);
    const audible = anySoloed ? state.solo : !state.muted;
    audio.volume = audible ? state.volume : 0;
    void name;
  }

  setChannelState(name: StemName, state: Partial<ChannelState>): void {
    this.mixer[name] = { ...this.mixer[name], ...state };
    for (const stemName of STEM_NAMES) {
      const audio = this.stemAudio[stemName];
      if (audio) this.applyChannelState(stemName, audio, this.mixer[stemName]);
    }
  }

  getMixerState(): MixerState {
    return this.mixer;
  }

  addLoopRegion(start: number, end: number): void {
    this.regionsPlugin.clearRegions();
    this.loopRegion = this.regionsPlugin.addRegion({
      start,
      end,
      color: "rgba(79, 70, 229, 0.2)",
      drag: true,
      resize: true,
    });
  }

  clearLoop(): void {
    this.regionsPlugin.clearRegions();
    this.loopRegion = null;
  }

  getLoopRegion(): { start: number; end: number } | null {
    return this.loopRegion ? { start: this.loopRegion.start, end: this.loopRegion.end } : null;
  }

  playPause(): void {
    void this.wavesurfer.playPause();
  }

  play(): void {
    void this.wavesurfer.play();
  }

  pause(): void {
    this.wavesurfer.pause();
  }

  seekTo(time: number): void {
    this.wavesurfer.setTime(time);
  }

  getCurrentTime(): number {
    return this.wavesurfer.getCurrentTime();
  }

  getDuration(): number {
    return this.wavesurfer.getDuration();
  }

  isPlaying(): boolean {
    return this.wavesurfer.isPlaying();
  }

  /** Tüm stem <audio> kaynaklarını değiştirir (ör. tempo/ton dönüşümü sonrası). */
  replaceStemSources(newUrls: Partial<Record<StemName, string>>): void {
    const wasPlaying = this.wavesurfer.isPlaying();
    const time = this.wavesurfer.getCurrentTime();

    for (const name of STEM_NAMES) {
      const url = newUrls[name];
      if (!url) continue;
      const existing = this.stemAudio[name];
      existing?.pause();
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.currentTime = time;
      this.applyChannelState(name, audio, this.mixer[name]);
      this.stemAudio[name] = audio;
    }

    if (wasPlaying) this.syncStemsToWavesurfer(true);
  }

  destroy(): void {
    for (const audio of Object.values(this.stemAudio)) {
      audio?.pause();
      audio?.removeAttribute("src");
    }
    this.wavesurfer.destroy();
    this.listeners.clear();
  }
}
