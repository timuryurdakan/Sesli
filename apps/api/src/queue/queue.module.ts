import { Global, Module } from '@nestjs/common';
import { TrackProcessingQueueService } from './track-processing.queue';
import { TrackProcessingWorker } from './track-processing.worker';

@Global()
@Module({
  providers: [TrackProcessingQueueService, TrackProcessingWorker],
  exports: [TrackProcessingQueueService],
})
export class QueueModule {}
