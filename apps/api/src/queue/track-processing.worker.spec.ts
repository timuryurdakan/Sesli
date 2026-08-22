import { Job } from 'bullmq';
import { TrackProcessingWorker } from './track-processing.worker';
import { SupabaseService } from '../supabase/supabase.service';
import { TrackProcessingJobPayload } from './track-processing.queue';

function makeJob(
  data: TrackProcessingJobPayload,
): Job<TrackProcessingJobPayload> {
  return { data } as Job<TrackProcessingJobPayload>;
}

type PrivateProcess = {
  process: (job: Job<TrackProcessingJobPayload>) => Promise<void>;
};

const JOB_DATA: TrackProcessingJobPayload = {
  jobId: 'job-1',
  trackId: 'track-1',
  storagePath: 'raw/u1/t1.wav',
};

describe('TrackProcessingWorker.process', () => {
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
    process.env.AI_SERVICE_INTERNAL_KEY = 'test-internal-key';
  });

  it('marks the job done with merged stems + chords + tempo on success', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ stems: { vocals: 'stems/job-1/vocals.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ chords: [{ start: 0, end: 1.8, chord: 'Am' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ bpm: 120.5, key: 'A minor' }),
      });

    const worker = new TrackProcessingWorker(supabase);
    await (worker as unknown as PrivateProcess).process(makeJob(JOB_DATA));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/separate',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8000/chords',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8000/tempo',
      expect.anything(),
    );
    expect(updateCalls).toEqual([
      { status: 'processing' },
      {
        status: 'done',
        output: {
          stems: { vocals: 'stems/job-1/vocals.wav' },
          chords: [{ start: 0, end: 1.8, chord: 'Am' }],
          bpm: 120.5,
          key: 'A minor',
        },
      },
    ]);
  });

  it('marks the job failed with the AI service error body on a non-OK response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('bad audio'),
    });

    const worker = new TrackProcessingWorker(supabase);
    await expect(
      (worker as unknown as PrivateProcess).process(makeJob(JOB_DATA)),
    ).rejects.toThrow();

    expect(updateCalls[1]).toEqual({
      status: 'failed',
      error:
        'AI servisi hatası (http://localhost:8000/separate, 422): bad audio',
    });
  });

  it('marks the job failed when the AI service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const worker = new TrackProcessingWorker(supabase);
    await expect(
      (worker as unknown as PrivateProcess).process(makeJob(JOB_DATA)),
    ).rejects.toThrow('ECONNREFUSED');

    expect(updateCalls[1]).toEqual({ status: 'failed', error: 'ECONNREFUSED' });
  });

  it('marks the job failed if chord detection fails after separation succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ stems: { vocals: 'stems/job-1/vocals.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('chord detection failed'),
      });

    const worker = new TrackProcessingWorker(supabase);
    await expect(
      (worker as unknown as PrivateProcess).process(makeJob(JOB_DATA)),
    ).rejects.toThrow();

    expect(updateCalls[1]).toEqual({
      status: 'failed',
      error:
        'AI servisi hatası (http://localhost:8000/chords, 500): chord detection failed',
    });
  });

  it('marks the job failed if tempo detection fails after chords succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ stems: { vocals: 'stems/job-1/vocals.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ chords: [{ start: 0, end: 1.8, chord: 'Am' }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('tempo detection failed'),
      });

    const worker = new TrackProcessingWorker(supabase);
    await expect(
      (worker as unknown as PrivateProcess).process(makeJob(JOB_DATA)),
    ).rejects.toThrow();

    expect(updateCalls[1]).toEqual({
      status: 'failed',
      error:
        'AI servisi hatası (http://localhost:8000/tempo, 500): tempo detection failed',
    });
  });
});
