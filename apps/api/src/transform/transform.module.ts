import { Module } from '@nestjs/common';
import { TransformController } from './transform.controller';

@Module({
  controllers: [TransformController],
})
export class TransformModule {}
