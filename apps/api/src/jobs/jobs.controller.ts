import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

interface JobRow {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  input: unknown;
  output: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

@Controller('jobs')
@UseGuards(SupabaseAuthGuard)
export class JobsController {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * İstemcinin (Supabase Realtime bağlantısı kopmuşsa veya ilk yüklemede)
   * bir işin durumunu sorgulayabilmesi için polling fallback'i. Asıl gerçek
   * zamanlı güncelleme istemci tarafında doğrudan `jobs` tablosuna Supabase
   * Realtime aboneliğiyle yapılır (bkz. supabase/migrations/0002).
   *
   * `supabase.admin` service-role client'ı kullanır (RLS'i bypass eder),
   * bu yüzden sahiplik kontrolü burada elle yapılır.
   */
  @Get(':id')
  async getJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { data: job, error } = await this.supabase.admin
      .from('jobs')
      .select(
        'id, status, input, output, error, created_at, updated_at, user_id',
      )
      .eq('id', id)
      .single<JobRow>();

    if (error || !job) {
      throw new NotFoundException('Job not found');
    }

    if (job.user_id !== user.id) {
      throw new ForbiddenException();
    }

    return {
      id: job.id,
      status: job.status,
      input: job.input,
      output: job.output,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }
}
