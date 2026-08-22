import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { buildAiServiceHeaders } from '../ai-service/ai-service-headers';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { TransformDto } from './transform.dto';

/**
 * Özellik 3 (tempo) ve Özellik 4 (ton değiştirme) için ince bir proxy:
 * oynatıcı (Ajan 7) bu uç noktayı çağırır, biz FastAPI AI servisinin
 * `POST /transform`'una (Ajan 6, SoundTouch) iletip sonucu geri döneriz.
 * `jobs`/`tracks` tablosuna dokunmaz — durumsuzdur.
 */
@Controller('transform')
@UseGuards(SupabaseAuthGuard)
export class TransformController {
  // SoundTouch dönüşümü CPU-yoğun (Ajan 12 Yüksek — maliyet istismarı riski);
  // global varsayılandan (dk. başına 60) daha sıkı: kullanıcı başına dakikada
  // 6 istek.
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post()
  async transform(
    @Body() body: TransformDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    if (typeof body.storagePath !== 'string' || body.storagePath.length === 0) {
      throw new BadRequestException('storagePath is required');
    }

    // storagePath, "raw/{userId}/{uploadId}.wav" biçiminde — kullanıcının
    // yalnızca kendi dosyasını dönüştürebildiğinden emin ol (RLS bypass
    // eden servis-role çağrısı olduğu için burada elle kontrol şart). Tam
    // segment eşleşmesi kullanılır (yalnızca `startsWith` değil) — ör.
    // "raw/{uid}/../{başkaUid}/x.wav" gibi bir değerin ön-ek kontrolünü
    // yanıltmasını önler (Ajan 12 Düşük bulgusu).
    const segments = body.storagePath.split('/');
    if (
      segments[0] !== 'raw' ||
      segments[1] !== user.id ||
      segments.includes('..')
    ) {
      throw new ForbiddenException();
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    const response = await fetch(`${aiServiceUrl}/transform`, {
      method: 'POST',
      headers: buildAiServiceHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new HttpException(detail, response.status);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/wav');
    res.send(buffer);
  }
}
