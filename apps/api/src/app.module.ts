import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { FfmpegModule } from './ffmpeg/ffmpeg.module';
import { QueueModule } from './queue/queue.module';
import { UploadsModule } from './uploads/uploads.module';
import { JobsModule } from './jobs/jobs.module';
import { TransformModule } from './transform/transform.module';
import { TracksModule } from './tracks/tracks.module';

@Module({
  imports: [
    SupabaseModule,
    FfmpegModule,
    QueueModule,
    UsersModule,
    UploadsModule,
    JobsModule,
    TransformModule,
    TracksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
