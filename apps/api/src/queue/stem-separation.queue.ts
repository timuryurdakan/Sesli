import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const STEM_SEPARATION_QUEUE_NAME = 'stem-separation';

export interface StemSeparationJobPayload {
  jobId: string;
  trackId: string;
  storagePath: string;
}

@Injectable()
export class StemSeparationQueueService {
  private queue: Queue<StemSeparationJobPayload> | undefined;

  private get client(): Queue<StemSeparationJobPayload> {
    if (!this.queue) {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error('REDIS_URL is not configured');
      }
      const connection = new IORedis(url, { maxRetriesPerRequest: null });
      this.queue = new Queue(STEM_SEPARATION_QUEUE_NAME, { connection });
    }
    return this.queue;
  }

  async enqueue(payload: StemSeparationJobPayload): Promise<void> {
    await this.client.add(STEM_SEPARATION_QUEUE_NAME, payload, {
      jobId: payload.jobId,
    });
  }
}
