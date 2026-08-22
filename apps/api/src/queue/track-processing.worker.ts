import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { buildAiServiceHeaders } from '../ai-service/ai-service-headers';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TRACK_PROCESSING_QUEUE_NAME,
  TrackProcessingJobPayload,
} from './track-processing.queue';

interface SeparateResponse {
  stems: Record<string, string>;
}

interface ChordSegment {
  start: number;
  end: number;
  chord: string;
}

interface ChordsResponse {
  chords: ChordSegment[];
}

interface TempoResponse {
  bpm: number;
  key: string;
}

/**
 * BullMQ worker: kuyruktaki "track-processing" işini alır ve FastAPI AI
 * servisinin ilgili uç noktalarını sırayla çağırır — stem ayırma (Ajan 4,
 * `POST /separate`), akor tespiti (Ajan 5, `POST /chords`), tempo/ton
 * tespiti (Ajan 6, `POST /tempo`). Sonuçlar tek bir `jobs.output`
 * JSON'ında birleştirilip `packages/shared-types`'taki `StemJobOutput`
 * sözleşmesine (`stems`, `chords`, `bpm`, `key`) uygun şekilde yazılır.
 *
 * CPU'da bir parçanın işlenmesi dakikalar sürebilir; bu yüzden burada kısa
 * bir HTTP timeout uygulanmaz — BullMQ zaten işi arka planda, kullanıcıyı
 * bekletmeden işler (kullanıcı Supabase Realtime ile `jobs` durumunu izler).
 */
@Injectable()
export class TrackProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackProcessingWorker.name);
  private worker: Worker<TrackProcessingJobPayload> | undefined;

  constructor(private readonly supabase: SupabaseService) {}

  onModuleInit(): void {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn(
        'REDIS_URL tanımlı değil — track-processing worker devre dışı (Redis olmadan yerel geliştirme).',
      );
      return;
    }

    const connection = new IORedis(url, { maxRetriesPerRequest: null });

    this.worker = new Worker<TrackProcessingJobPayload>(
      TRACK_PROCESSING_QUEUE_NAME,
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

  private async process(job: Job<TrackProcessingJobPayload>): Promise<void> {
    const { jobId, storagePath } = job.data;
    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    await this.updateJobStatus(jobId, 'processing');

    const separated = await this.callAiService<SeparateResponse>(
      jobId,
      `${aiServiceUrl}/separate`,
      {
        jobId,
        storagePath,
      },
    );

    const chords = await this.callAiService<ChordsResponse>(
      jobId,
      `${aiServiceUrl}/chords`,
      {
        storagePath,
      },
    );

    const tempo = await this.callAiService<TempoResponse>(
      jobId,
      `${aiServiceUrl}/tempo`,
      {
        storagePath,
      },
    );

    await this.updateJobStatus(jobId, 'done', {
      stems: separated.stems,
      chords: chords.chords,
      bpm: tempo.bpm,
      key: tempo.key,
    });
  }

  /**
   * AI servisine POST isteği atar; ağ hatası veya non-2xx yanıt durumunda
   * işi `failed` olarak işaretleyip anlamlı bir mesajla hatayı fırlatır.
   */
  private async callAiService<T>(
    jobId: string,
    url: string,
    body: unknown,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: buildAiServiceHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'AI servisine ulaşılamadı';
      await this.updateJobStatus(jobId, 'failed', undefined, message);
      throw err instanceof Error ? err : new Error(message);
    }

    if (!response.ok) {
      const detail = await response.text();
      const message = `AI servisi hatası (${url}, ${response.status}): ${detail}`;
      await this.updateJobStatus(jobId, 'failed', undefined, message);
      throw new Error(message);
    }

    return (await response.json()) as T;
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
