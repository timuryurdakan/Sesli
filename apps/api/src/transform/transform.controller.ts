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
import type { Response } from 'express';
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
    // eden servis-role çağrısı olduğu için burada elle kontrol şart).
    const expectedPrefix = `raw/${user.id}/`;
    if (!body.storagePath.startsWith(expectedPrefix)) {
      throw new ForbiddenException();
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

    const response = await fetch(`${aiServiceUrl}/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
