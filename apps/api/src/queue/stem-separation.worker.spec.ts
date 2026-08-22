import { Job } from 'bullmq';
import { StemSeparationWorker } from './stem-separation.worker';
import { SupabaseService } from '../supabase/supabase.service';
import { StemSeparationJobPayload } from './stem-separation.queue';

function makeJob(
  data: StemSeparationJobPayload,
): Job<StemSeparationJobPayload> {
  return { data } as Job<StemSeparationJobPayload>;
}

describe('StemSeparationWorker.process', () => {
  let updateCalls: Array<Record<string, unknown>>;
  let supabase: SupabaseService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    updateCalls = [];
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn((payload: Record<string, unknown>) => {
      updateCalls.push(payload);
      return { eq };
    });
    const from = jest.fn().mockReturnValue({ update });
    supabase = { admin: { from } } as unknown as SupabaseService;

    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('marks the job done with the returned stems on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ stems: { vocals: 'stems/job-1/vocals.wav' } }),
    });

    const worker = new StemSeparationWorker(supabase);
    await (
      worker as unknown as {
        process: (job: Job<StemSeparationJobPayload>) => Promise<void>;
      }
    ).process(
      makeJob({
        jobId: 'job-1',
        trackId: 'track-1',
        storagePath: 'raw/u1/t1.wav',
      }),
    );

    expect(updateCalls).toEqual([
      { status: 'processing' },
      {
        status: 'done',
        output: { stems: { vocals: 'stems/job-1/vocals.wav' } },
      },
    ]);
  });

  it('marks the job failed with the AI service error body on a non-OK response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('bad audio'),
    });

    const worker = new StemSeparationWorker(supabase);
    await expect(
      (
        worker as unknown as {
          process: (job: Job<StemSeparationJobPayload>) => Promise<void>;
        }
      ).process(
        makeJob({
          jobId: 'job-1',
          trackId: 'track-1',
          storagePath: 'raw/u1/t1.wav',
        }),
      ),
    ).rejects.toThrow();

    expect(updateCalls[1]).toEqual({
      status: 'failed',
      error: 'AI servisi hatası (422): bad audio',
    });
  });

  it('marks the job failed when the AI service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const worker = new StemSeparationWorker(supabase);
    await expect(
      (
        worker as unknown as {
          process: (job: Job<StemSeparationJobPayload>) => Promise<void>;
        }
      ).process(
        makeJob({
          jobId: 'job-1',
          trackId: 'track-1',
          storagePath: 'raw/u1/t1.wav',
        }),
      ),
    ).rejects.toThrow('ECONNREFUSED');

    expect(updateCalls[1]).toEqual({ status: 'failed', error: 'ECONNREFUSED' });
  });
});
