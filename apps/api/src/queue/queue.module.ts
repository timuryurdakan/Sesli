import { Global, Module } from '@nestjs/common';
import { StemSeparationQueueService } from './stem-separation.queue';
import { StemSeparationWorker } from './stem-separation.worker';

@Global()
@Module({
  providers: [StemSeparationQueueService, StemSeparationWorker],
  exports: [StemSeparationQueueService],
})
export class QueueModule {}
