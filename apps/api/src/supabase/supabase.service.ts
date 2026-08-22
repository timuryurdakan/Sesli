import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient | undefined;

  /**
   * Lazily constructed so the API can boot without Supabase credentials
   * (e.g. Stage 01 skeleton, or CI) — it only throws once a route actually
   * needs Supabase and the env vars are still missing.
   */
  get admin(): SupabaseClient {
    if (!this.client) {
      const url = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !serviceRoleKey) {
        throw new Error(
          'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured',
        );
      }

      this.client = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    return this.client;
  }
}
