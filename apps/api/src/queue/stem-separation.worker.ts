import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import {
  STEM_SEPARATION_QUEUE_NAME,
  StemSeparationJobPayload,
} from './stem-separation.queue';

interface SeparateResponse {
  stems: Record<string, string>;
}

/**
 * BullMQ worker: kuyruktaki "stem-separation" işini alır, FastAPI AI
 * servisinin `POST /separate` uç noktasını çağırır (Demucs `htdemucs_6s` —
 * bkz. apps/ai-service/app/services/separation.py), sonucu `jobs` tablosuna
 * yazar. Bölüm 7 Ajan 4.
 *
 * CPU'da bir parçanın ayrılması dakikalar sürebilir (~1.5x parça süresi);
 * bu yüzden burada kısa bir HTTP timeout uygulanmaz — BullMQ zaten işi
 * arka planda, kullanıcıyı bekletmeden işler (kullanıcı Supabase Realtime
 * ile `jobs` durumunu izler).
 */
@Injectable()
export class StemSeparationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StemSeparationWorker.name);
  private worker: Worker<StemSeparationJobPayload> | undefined;

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit(): void {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn(
        'REDIS_URL tanımlı değil — stem-separation worker devre dışı (Redis olmadan yerel geliştirme).',
      );
      return;
    }

    const connection = new IORedis(url, { maxRetriesPerRequest: null });

    this.worker = new Worker<StemSeparationJobPayload>(
      STEM_SEPARATION_QUEUE_NAME,
      (job) => this.process(job),
      { connection, concurrency: Number(process.env.MAX_CONCURRENT_JOBS) || 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<StemSeparationJobPayload>): Promise<void> {
    const { jobId, storagePath } = job.data;

    await this.updateJobStatus(jobId, 'processing');

    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
    let response: Response;

    try {
      response = await fetch(`${aiServiceUrl}/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, storagePath }),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'AI servisine ulaşılamadı';
      await this.updateJobStatus(jobId, 'failed', undefined, message);
      throw err;
    }

    if (!response.ok) {
      const detail = await response.text();
      const message = `AI servisi hatası (${response.status}): ${detail}`;
      await this.updateJobStatus(jobId, 'failed', undefined, message);
      throw new Error(message);
    }

    const { stems } = (await response.json()) as SeparateResponse;
    await this.updateJobStatus(jobId, 'done', { stems });
  }

  private async updateJobStatus(
    jobId: string,
    status: 'processing' | 'done' | 'failed',
    output?: unknown,
    errorMessage?: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('jobs')
      .update({
        status,
        ...(output ? { output } : {}),
        ...(errorMessage ? { error: errorMessage } : {}),
      })
      .eq('id', jobId);

    if (error) {
      this.logger.error(`Job ${jobId} durumu güncellenemedi: ${error.message}`);
    }
  }
}
