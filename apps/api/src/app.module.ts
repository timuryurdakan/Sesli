import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
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
    SentryModule.forRoot(),
    // Ajan 12 Yüksek bulgusu: pahalı uç noktalarda (özellikle /transform,
    // SoundTouch tetikleyen) rate limiting yoktu. Global varsayılan: IP
    // başına dakikada 60 istek; maliyeti yüksek rotalar (@Throttle ile)
    // TransformController'da daha sıkı sınırlanır. tus upload middleware
    // (TusUploadMiddleware) NestJS guard pipeline'ının dışında çalıştığından
    // ayrıca kendi kullanıcı-bazlı sınırlamasına sahiptir (bkz.
    // tus-upload.middleware.ts).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
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
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
