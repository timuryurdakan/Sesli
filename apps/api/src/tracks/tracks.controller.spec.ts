import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { SupabaseService } from '../supabase/supabase.service';

function makeSupabaseMock(options: {
  track: unknown;
  trackError?: unknown;
  job?: unknown;
  signedUrl?: string;
}) {
  const tracksQuery = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: options.track,
      error: options.trackError ?? null,
    }),
  };

  const jobsQuery = {
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.job ?? null }),
  };

  const from = jest.fn((table: string) => {
    if (table === 'tracks') {
      return { select: jest.fn().mockReturnValue(tracksQuery) };
    }
    return { select: jest.fn().mockReturnValue(jobsQuery) };
  });

  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: options.signedUrl ?? 'https://signed.example/url' },
    error: null,
  });

  return {
    admin: {
      from,
      storage: { from: jest.fn().mockReturnValue({ createSignedUrl }) },
    },
  } as unknown as SupabaseService;
}

describe('TracksController.getTrack', () => {
  it('throws NotFoundException when the track does not exist', async () => {
    const supabase = makeSupabaseMock({
      track: null,
      trackError: { message: 'no rows' },
    });
    const controller = new TracksController(supabase);

    await expect(
      controller.getTrack('missing', { id: 'user-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the track belongs to another user', async () => {
    const supabase = makeSupabaseMock({
      track: {
        id: 't1',
        title: 'Song',
        duration_seconds: 180,
        storage_path: 'raw/x',
        user_id: 'other',
      },
    });
    const controller = new TracksController(supabase);

    await expect(controller.getTrack('t1', { id: 'user-1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns the track with a signed raw URL and no job when none exists', async () => {
    const supabase = makeSupabaseMock({
      track: {
        id: 't1',
        title: 'Song',
        duration_seconds: 180,
        storage_path: 'raw/user-1/t1.wav',
        created_at: '2026-01-01T00:00:00Z',
        user_id: 'user-1',
      },
      job: null,
    });
    const controller = new TracksController(supabase);

    const result = await controller.getTrack('t1', { id: 'user-1' });

    expect(result).toEqual({
      id: 't1',
      title: 'Song',
      durationSeconds: 180,
      createdAt: '2026-01-01T00:00:00Z',
      rawUrl: 'https://signed.example/url',
      job: null,
    });
  });

  it('signs each stem URL when a completed job exists', async () => {
    const supabase = makeSupabaseMock({
      track: {
        id: 't1',
        title: 'Song',
        duration_seconds: 180,
        storage_path: 'raw/user-1/t1.wav',
        created_at: '2026-01-01T00:00:00Z',
        user_id: 'user-1',
      },
      job: {
        id: 'j1',
        status: 'done',
        error: null,
        output: {
          stems: { vocals: 'stems/j1/vocals.wav', drums: 'stems/j1/drums.wav' },
          chords: [{ start: 0, end: 1.8, chord: 'Am' }],
          bpm: 120,
          key: 'A minor',
        },
      },
    });
    const controller = new TracksController(supabase);

    const result = await controller.getTrack('t1', { id: 'user-1' });

    expect(result.job).toEqual({
      status: 'done',
      error: null,
      chords: [{ start: 0, end: 1.8, chord: 'Am' }],
      bpm: 120,
      key: 'A minor',
      stems: {
        vocals: 'https://signed.example/url',
        drums: 'https://signed.example/url',
      },
      stemPaths: { vocals: 'stems/j1/vocals.wav', drums: 'stems/j1/drums.wav' },
    });
  });
});
