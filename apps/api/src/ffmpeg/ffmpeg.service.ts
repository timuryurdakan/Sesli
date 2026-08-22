import { Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Bölüm 9.2: FFmpeg yalnızca LGPL derlemesiyle kullanılmalı (GPL bileşenler
 * — libx264/libx265/librubberband vb. — dahil edilmemeli). `FFMPEG_PATH` /
 * `FFPROBE_PATH` env değişkenleriyle böyle bir derlemenin (ör. BtbN
 * FFmpeg-Builds "lgpl" varyantı) yolu verilmelidir; bu servis binary'yi
 * bundle etmez. Detaylar için apps/api/.env.example ve
 * docs/handoffs/stage-03.md içindeki not.
 */
@Injectable()
export class FfmpegService {
  constructor() {
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    if (process.env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
    }
  }

  normalizeToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioChannels(2)
        .audioFrequency(44100)
        .format('wav')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  getDurationSeconds(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err: Error | null, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.format.duration ?? 0);
      });
    });
  }
}
