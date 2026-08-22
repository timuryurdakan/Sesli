import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const TRACK_PROCESSING_QUEUE_NAME = 'track-processing';

export interface TrackProcessingJobPayload {
  jobId: string;
  trackId: string;
  storagePath: string;
}

@Injectable()
export class TrackProcessingQueueService {
  private queue: Queue<TrackProcessingJobPayload> | undefined;

  private get client(): Queue<TrackProcessingJobPayload> {
    if (!this.queue) {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error('REDIS_URL is not configured');
      }
      const connection = new IORedis(url, { maxRetriesPerRequest: null });
      this.queue = new Queue(TRACK_PROCESSING_QUEUE_NAME, { connection });
    }
    return this.queue;
  }

  async enqueue(payload: TrackProcessingJobPayload): Promise<void> {
    await this.client.add(TRACK_PROCESSING_QUEUE_NAME, payload, {
      jobId: payload.jobId,
    });
  }
}
