import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { SupabaseService } from '../supabase/supabase.service';

function makeSupabaseMock(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { admin: { from } } as unknown as SupabaseService;
}

describe('JobsController', () => {
  it('throws NotFoundException when the job does not exist', async () => {
    const supabase = makeSupabaseMock({
      data: null,
      error: { message: 'no rows' },
    });
    const controller = new JobsController(supabase);

    await expect(
      controller.getJob('missing-id', { id: 'user-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the job belongs to another user', async () => {
    const supabase = makeSupabaseMock({
      data: { id: 'job-1', user_id: 'someone-else', status: 'pending' },
      error: null,
    });
    const controller = new JobsController(supabase);

    await expect(controller.getJob('job-1', { id: 'user-1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns the job without exposing user_id when owned by the caller', async () => {
    const supabase = makeSupabaseMock({
      data: {
        id: 'job-1',
        user_id: 'user-1',
        status: 'done',
        input: { a: 1 },
        output: { b: 2 },
        error: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:01:00Z',
      },
      error: null,
    });
    const controller = new JobsController(supabase);

    const result = await controller.getJob('job-1', { id: 'user-1' });

    expect(result).toEqual({
      id: 'job-1',
      status: 'done',
      input: { a: 1 },
      output: { b: 2 },
      error: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:01:00Z',
    });
    expect(result).not.toHaveProperty('user_id');
  });
});
