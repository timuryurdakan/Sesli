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
   * kalıcı olarak silebilmeli. `profiles` tablosundaki satır, auth.users
   * silindiğinde ON DELETE CASCADE ile otomatik silinir (bkz.
   * supabase/migrations/0001_profiles.sql).
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }
}
