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

/**
 * PLACEHOLDER worker (Stage 03 / Ajan 3 DoD: "sahte/iskelet worker ile uçtan
 * uca test edilmiş olmalı"). Gerçek Demucs çağrısı Ajan 4'ün (Stage 04)
 * kapsamındadır — bu worker yalnızca pending -> processing -> done geçişini
 * simüle ederek kuyruk/durum-bildirim borusunun uçtan uca çalıştığını
 * kanıtlamak içindir. Aynı Node process'i içinde çalışır (BullMQ Worker);
 * üretimde ayrı bir process/servise taşımak isteğe bağlıdır.
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
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<StemSeparationJobPayload>): Promise<void> {
    const { jobId } = job.data;

    await this.updateJobStatus(jobId, 'processing');

    // PLACEHOLDER: gerçek Demucs/FastAPI çağrısı burada yapılacak (Ajan 4).
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.updateJobStatus(jobId, 'done', {
      note: 'placeholder worker output — Ajan 4 gerçek stem/akor/tempo sonucuyla değiştirecek',
    });
  }

  private async updateJobStatus(
    jobId: string,
    status: 'processing' | 'done' | 'failed',
    output?: unknown,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('jobs')
      .update({ status, ...(output ? { output } : {}) })
      .eq('id', jobId);

    if (error) {
      this.logger.error(`Job ${jobId} durumu güncellenemedi: ${error.message}`);
    }
  }
}
