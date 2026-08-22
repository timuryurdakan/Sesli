import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * KVKK/GDPR "unutulma hakkı" (Bölüm 6.6 / 9.3): kullanıcı kendi hesabını
   * kalıcı olarak silebilmeli. `profiles`/`tracks`/`jobs`/`playlists`
   * tablolarındaki satırlar, auth.users silindiğinde ON DELETE CASCADE ile
   * otomatik silinir (bkz. supabase/migrations/0001-0004). Ancak Storage
   * nesneleri (ham kayıtlar + ayrılmış stem'ler) bu cascade'e dahil değildir
   * — `storage.objects` hiçbir FK ile auth.users'a bağlı değil — bu yüzden
   * auth kullanıcısı silinmeden ÖNCE elle temizlenmesi gerekir (Ajan 12
   * Kritik #2: bu adım eksikti, "unutulma hakkı" ihlal ediliyordu).
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.deleteUserStorageObjects(user.id);

    const { error } = await this.supabase.admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }

  private async deleteUserStorageObjects(userId: string): Promise<void> {
    const [tracksResult, jobsResult] = await Promise.all([
      this.supabase.admin
        .from('tracks')
        .select('storage_path')
        .eq('user_id', userId),
      this.supabase.admin.from('jobs').select('output').eq('user_id', userId),
    ]);

    if (tracksResult.error) {
      throw tracksResult.error;
    }
    if (jobsResult.error) {
      throw jobsResult.error;
    }

    const tracks = (tracksResult.data ?? []) as {
      storage_path: string | null;
    }[];
    const jobs = (jobsResult.data ?? []) as {
      output: { stems?: Record<string, string> } | null;
    }[];

    const paths = new Set<string>();

    for (const track of tracks) {
      if (track.storage_path) {
        paths.add(track.storage_path);
      }
    }

    for (const job of jobs) {
      for (const stemPath of Object.values(job.output?.stems ?? {})) {
        paths.add(stemPath);
      }
    }

    if (paths.size === 0) {
      return;
    }

    const { error: removeError } = await this.supabase.admin.storage
      .from('tracks')
      .remove([...paths]);

    if (removeError) {
      throw removeError;
    }
  }
}
