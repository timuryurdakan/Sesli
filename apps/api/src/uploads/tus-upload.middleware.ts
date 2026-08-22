import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Server, type Upload } from '@tus/server';
import { FileStore } from '@tus/file-store';
import type { Request, Response } from 'express';
import { fileTypeFromFile } from 'file-type';
import * as jwt from 'jsonwebtoken';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { StemSeparationQueueService } from '../queue/stem-separation.queue';
import { SupabaseService } from '../supabase/supabase.service';
import { getMaxUploadBytes, isAllowedMimeType } from './upload-validation';

/**
 * `@tus/server`'ın hook sözleşmesi hataları `{ status_code, body }` şeklinde
 * plain object olarak throw etmeyi bekliyor (bkz. types.d.ts açıklaması).
 * `only-throw-error` kuralını ihlal etmeden aynı sözleşmeyi sağlamak için
 * gerçek bir `Error` alt sınıfı kullanıyoruz — tus, yakaladığı hatadan yalnızca
 * `status_code`/`body` alanlarını okuyor, `instanceof Error` olması sonucu
 * etkilemiyor.
 */
class TusRequestError extends Error {
  constructor(
    public readonly status_code: number,
    public readonly body: string,
  ) {
    super(body);
  }
}

const UPLOAD_TMP_DIR =
  process.env.UPLOAD_TMP_DIR ?? path.join(process.cwd(), '.tmp', 'uploads');

/**
 * @tus/server v2'nin hook tipleri `srvx`'in web-standard `Request`'ini referans
 * alıyor, ama `Server.handle()` gerçekte Node'un `http.IncomingMessage`'ını
 * kabul ediyor (bkz. server.d.ts) — bu iki tip birbiriyle tam örtüşmüyor.
 * Bu yardımcı, hangi şekilde gelirse gelsin header okumayı güvenli hale getirir.
 */
function readHeader(req: unknown, name: string): string | undefined {
  const headers = (req as { headers?: unknown }).headers;
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  return (headers as Record<string, string | undefined>)[name];
}

/**
 * Chunked/resumable dosya yükleme (Özellik 1 altyapısı, Bölüm 7 Ajan 3).
 * tus protokolünü (`@tus/server`) kullanır: büyük ses/video dosyaları parça
 * parça, kesintiye dayanıklı şekilde yüklenir. Yükleme tamamlanınca:
 *   1. Gerçek MIME türü magic-byte sniffing ile doğrulanır (yalnızca uzantıya
 *      güvenilmez — Bölüm 6.6/9.4/12).
 *   2. FFmpeg (LGPL derleme — bkz. FfmpegService) ile standart WAV/PCM'e
 *      normalize edilir.
 *   3. Supabase Storage'a yüklenir, `tracks` + `jobs` satırları oluşturulur.
 *   4. BullMQ'ya "stem-separation" işi eklenir.
 */
@Injectable()
export class TusUploadMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TusUploadMiddleware.name);
  private tusServer: Server | undefined;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ffmpeg: FfmpegService,
    private readonly queue: StemSeparationQueueService,
  ) {}

  use(req: Request, res: Response): void {
    void this.getServer().handle(req, res);
  }

  private getServer(): Server {
    if (!this.tusServer) {
      this.tusServer = new Server({
        path: '/uploads',
        datastore: new FileStore({ directory: UPLOAD_TMP_DIR }),
        maxSize: getMaxUploadBytes(),
        onUploadCreate: (req, upload) => {
          const userId = this.authenticate(req);
          return Promise.resolve({ metadata: { ...upload.metadata, userId } });
        },
        onUploadFinish: async (_req, upload) => {
          await this.handleUploadFinish(upload);
          return {};
        },
      });
    }
    return this.tusServer;
  }

  private authenticate(req: unknown): string {
    const authHeader = readHeader(req, 'authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const secret = process.env.SUPABASE_JWT_SECRET;

    if (!token || !secret) {
      throw new TusRequestError(401, 'Missing or invalid bearer token');
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      return payload.sub as string;
    } catch {
      throw new TusRequestError(401, 'Invalid or expired token');
    }
  }

  private async handleUploadFinish(upload: Upload): Promise<void> {
    const userId = upload.metadata?.userId ?? undefined;
    const originalName = upload.metadata?.filename ?? upload.id;
    const uploadedPath =
      upload.storage?.path ?? path.join(UPLOAD_TMP_DIR, upload.id);

    if (!userId) {
      await fs.rm(uploadedPath, { force: true });
      throw new TusRequestError(400, 'Missing authenticated user');
    }

    const detected = await fileTypeFromFile(uploadedPath);
    if (!isAllowedMimeType(detected?.mime)) {
      await fs.rm(uploadedPath, { force: true });
      throw new TusRequestError(
        415,
        `Unsupported file type: ${detected?.mime ?? 'unknown'}`,
      );
    }

    const normalizedPath = `${uploadedPath}.wav`;

    try {
      await this.ffmpeg.normalizeToWav(uploadedPath, normalizedPath);
      const durationSeconds =
        await this.ffmpeg.getDurationSeconds(uploadedPath);

      const storagePath = `raw/${userId}/${upload.id}.wav`;
      const fileBuffer = await fs.readFile(normalizedPath);

      const { error: uploadError } = await this.supabase.admin.storage
        .from('tracks')
        .upload(storagePath, fileBuffer, {
          contentType: 'audio/wav',
          upsert: false,
        });

      if (uploadError) {
        throw new TusRequestError(
          500,
          `Storage upload failed: ${uploadError.message}`,
        );
      }

      const { data: track, error: trackError } = await this.supabase.admin
        .from('tracks')
        .insert({
          user_id: userId,
          title: originalName,
          storage_path: storagePath,
          duration_seconds: durationSeconds,
        })
        .select('id')
        .single<{ id: string }>();

      if (trackError || !track) {
        throw new TusRequestError(
          500,
          `Track kaydı oluşturulamadı: ${trackError?.message}`,
        );
      }

      const { data: jobRow, error: jobError } = await this.supabase.admin
        .from('jobs')
        .insert({
          user_id: userId,
          track_id: track.id,
          status: 'pending',
          input: { storagePath, durationSeconds },
        })
        .select('id')
        .single<{ id: string }>();

      if (jobError || !jobRow) {
        throw new TusRequestError(
          500,
          `İş kaydı oluşturulamadı: ${jobError?.message}`,
        );
      }

      await this.queue.enqueue({
        jobId: jobRow.id,
        trackId: track.id,
        storagePath,
      });
    } finally {
      await fs.rm(uploadedPath, { force: true });
      await fs.rm(normalizedPath, { force: true });
    }
  }
}
