import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Server, type Upload } from '@tus/server';
import { FileStore } from '@tus/file-store';
import type { Request, Response } from 'express';
import { fileTypeFromFile } from 'file-type';
import * as jwt from 'jsonwebtoken';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { TrackProcessingQueueService } from '../queue/track-processing.queue';
import { SupabaseService } from '../supabase/supabase.service';
import {
  getMaxUploadBytes,
  getStorageQuotaBytes,
  isAllowedMimeType,
  wouldExceedStorageQuota,
} from './upload-validation';

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

  // Ajan 12 Yüksek bulgusu: bu middleware NestJS guard pipeline'ının (ve
  // dolayısıyla ThrottlerGuard'ın) dışında çalışıyor, bu yüzden kendi
  // kullanıcı-bazlı hız sınırlamasını yapıyor. Bellek-içi (in-memory) sabit
  // pencere sayaç — tek instance için yeterli; yatay ölçekleme (birden çok
  // API instance'ı) durumunda Redis-tabanlı paylaşımlı bir sayaca
  // taşınmalıdır (bilinen sınırlama, launch öncesi tek instance MVP için
  // kabul edilebilir).
  private readonly uploadCreateTimestamps = new Map<string, number[]>();
  private static readonly MAX_UPLOAD_CREATES_PER_WINDOW = 10;
  private static readonly UPLOAD_CREATE_WINDOW_MS = 60 * 60 * 1000;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ffmpeg: FfmpegService,
    private readonly queue: TrackProcessingQueueService,
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
          this.enforceUploadRateLimit(userId);
          return Promise.resolve({ metadata: { ...upload.metadata, userId } });
        },
        onUploadFinish: async (_req, upload) => {
          const { trackId, jobId } = await this.handleUploadFinish(upload);
          // tus spesifikasyonu response body'yi öngörmez ama çoğu istemci
          // (tus-js-client dahil) destekler — web istemcisi (Ajan 7) bu
          // sayede yükleme bitince doğrudan /tracks/{trackId}'e yönlenebilir.
          return { body: JSON.stringify({ trackId, jobId }) };
        },
      });
    }
    return this.tusServer;
  }

  private enforceUploadRateLimit(userId: string): void {
    const now = Date.now();
    const windowStart = now - TusUploadMiddleware.UPLOAD_CREATE_WINDOW_MS;
    const timestamps = (this.uploadCreateTimestamps.get(userId) ?? []).filter(
      (t) => t > windowStart,
    );

    if (
      timestamps.length >= TusUploadMiddleware.MAX_UPLOAD_CREATES_PER_WINDOW
    ) {
      throw new TusRequestError(
        429,
        'Çok fazla yükleme isteği — lütfen daha sonra tekrar deneyin',
      );
    }

    timestamps.push(now);
    this.uploadCreateTimestamps.set(userId, timestamps);
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

  /**
   * Bölüm 7 Ajan 8 / 9.4: FFmpeg normalizasyonu gibi pahalı işler başlamadan
   * önce, kullanıcının mevcut kullanımına bu yüklemenin ham (henüz normalize
   * edilmemiş) boyutu eklendiğinde kotayı bariz biçimde aşıp aşmadığına
   * bakan HIZLI ve NON-AUTHORITATIVE bir ön kontrol. Yalnızca gereksiz
   * FFmpeg/Storage işini erken keser — TOCTOU'ya karşı korumasızdır ve ham
   * boyut normalize edilmiş WAV'dan küçük olabileceğinden (örn. mp3→WAV)
   * kotayı olduğundan düşük tahmin edebilir. Asıl/otoriter ve atomik kontrol,
   * gerçek (normalize edilmiş) boyutla `insert_track_if_within_quota`
   * Postgres fonksiyonu üzerinden `handleUploadFinish`'te yapılır (Ajan 12
   * Yüksek bulgusu, Stage 10 sonrası düzeltme — bkz.
   * supabase/migrations/0006_atomic_storage_quota.sql).
   */
  private async enforceStorageQuota(
    userId: string,
    incomingBytes: number,
    uploadedPath: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.admin
      .from('tracks')
      .select('size_bytes')
      .eq('user_id', userId);

    if (error) {
      throw new TusRequestError(
        500,
        `Kota kontrolü başarısız: ${error.message}`,
      );
    }

    const currentUsage = (data ?? []).reduce(
      (sum: number, row: { size_bytes: number | null }) =>
        sum + (row.size_bytes ?? 0),
      0,
    );

    if (
      wouldExceedStorageQuota(
        currentUsage,
        incomingBytes,
        getStorageQuotaBytes(),
      )
    ) {
      await fs.rm(uploadedPath, { force: true });
      throw new TusRequestError(413, 'Depolama kotası aşıldı');
    }
  }

  private async handleUploadFinish(
    upload: Upload,
  ): Promise<{ trackId: string; jobId: string }> {
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

    await this.enforceStorageQuota(userId, upload.size ?? 0, uploadedPath);

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

      // Kota kontrolü ve track-insert'i tek bir atomik Postgres fonksiyonu
      // üzerinden yapılır (kullanıcı bazlı advisory lock ile serileştirilir)
      // — hem TOCTOU yarış durumunu hem de ham/normalize boyut
      // tutarsızlığını giderir (Ajan 12 Yüksek bulgusu). Bu, Storage'a
      // yüklemeden SONRA çalışır; kota aşılırsa az önce yüklenen nesne geri
      // alınır.
      const rpcResult = await this.supabase.admin.rpc(
        'insert_track_if_within_quota',
        {
          p_user_id: userId,
          p_title: originalName,
          p_storage_path: storagePath,
          p_duration_seconds: durationSeconds,
          p_size_bytes: fileBuffer.length,
          p_quota_bytes: getStorageQuotaBytes(),
        },
      );
      const track = rpcResult.data as { id: string } | null;
      const trackError = rpcResult.error;

      if (trackError?.message?.includes('STORAGE_QUOTA_EXCEEDED')) {
        await this.supabase.admin.storage.from('tracks').remove([storagePath]);
        throw new TusRequestError(413, 'Depolama kotası aşıldı');
      }

      if (trackError || !track) {
        await this.supabase.admin.storage.from('tracks').remove([storagePath]);
        throw new TusRequestError(
          500,
          `Track kaydı oluşturulamadı: ${trackError?.message}`,
        );
      }

      const trackId = track.id;

      const { data: jobRow, error: jobError } = await this.supabase.admin
        .from('jobs')
        .insert({
          user_id: userId,
          track_id: trackId,
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
        trackId,
        storagePath,
      });

      return { trackId, jobId: jobRow.id };
    } finally {
      await fs.rm(uploadedPath, { force: true });
      await fs.rm(normalizedPath, { force: true });
    }
  }
}
