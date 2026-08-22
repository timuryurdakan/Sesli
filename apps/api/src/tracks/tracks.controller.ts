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

const SIGNED_URL_TTL_SECONDS = 3600;
const STORAGE_BUCKET = 'tracks';

interface TrackRow {
  id: string;
  title: string;
  duration_seconds: number | null;
  storage_path: string;
  created_at: string;
  user_id: string;
}

interface JobRow {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  output: {
    stems?: Record<string, string>;
    chords?: { start: number; end: number; chord: string }[];
    bpm?: number;
    key?: string;
  } | null;
  error: string | null;
}

@Controller('tracks')
@UseGuards(SupabaseAuthGuard)
export class TracksController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async listTracks(@CurrentUser() user: AuthenticatedUser) {
    const { data, error } = await this.supabase.admin
      .from('tracks')
      .select('id, title, duration_seconds, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  @Get(':id')
  async getTrack(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { data: track, error: trackError } = await this.supabase.admin
      .from('tracks')
      .select('id, title, duration_seconds, storage_path, created_at, user_id')
      .eq('id', id)
      .single<TrackRow>();

    if (trackError || !track) {
      throw new NotFoundException('Track not found');
    }

    if (track.user_id !== user.id) {
      throw new ForbiddenException();
    }

    const { data: job } = await this.supabase.admin
      .from('jobs')
      .select('id, status, output, error')
      .eq('track_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<JobRow>();

    const rawUrl = await this.signUrl(track.storage_path);
    const stemUrls = job?.output?.stems
      ? await this.signStems(job.output.stems)
      : undefined;

    return {
      id: track.id,
      title: track.title,
      durationSeconds: track.duration_seconds,
      createdAt: track.created_at,
      rawUrl,
      job: job
        ? {
            status: job.status,
            error: job.error,
            chords: job.output?.chords ?? [],
            bpm: job.output?.bpm ?? null,
            key: job.output?.key ?? null,
            stems: stemUrls,
            // Oynatılabilir imzalı URL'lerden ayrı olarak: istemcinin
            // Özellik 3/4 (tempo/ton) için `/transform`'u çağırırken
            // ihtiyaç duyduğu ham storage path'leri (bkz. Stage 07).
            stemPaths: job.output?.stems ?? {},
          }
        : null,
    };
  }

  private async signUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await this.supabase.admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    return error ? null : data.signedUrl;
  }

  private async signStems(
    stems: Record<string, string>,
  ): Promise<Record<string, string | null>> {
    const entries = await Promise.all(
      Object.entries(stems).map(
        async ([name, path]) => [name, await this.signUrl(path)] as const,
      ),
    );
    return Object.fromEntries(entries);
  }
}
