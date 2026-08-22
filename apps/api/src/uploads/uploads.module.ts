import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TusUploadMiddleware } from './tus-upload.middleware';

@Module({})
export class UploadsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TusUploadMiddleware).forRoutes('uploads', 'uploads/{*path}');
  }
}
