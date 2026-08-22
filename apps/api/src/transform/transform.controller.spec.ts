import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { TransformController } from './transform.controller';
import type { Response } from 'express';

function makeRes(): { res: Response; send: jest.Mock; setHeader: jest.Mock } {
  const send = jest.fn();
  const setHeader = jest.fn();
  const res = { send, setHeader } as unknown as Response;
  return { res, send, setHeader };
}

describe('TransformController', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    process.env.AI_SERVICE_INTERNAL_KEY = 'test-internal-key';
  });

  it('rejects a missing storagePath', async () => {
    const { res } = makeRes();
    const controller = new TransformController();
    await expect(
      controller.transform({} as never, { id: 'user-1' }, res),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a storagePath that doesn't belong to the caller", async () => {
    const { res } = makeRes();
    const controller = new TransformController();
    await expect(
      controller.transform(
        { storagePath: 'raw/someone-else/t1.wav' },
        { id: 'user-1' },
        res,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('proxies to the AI service and streams back audio bytes on success', async () => {
    const audioBytes = new Uint8Array([1, 2, 3]).buffer;
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(audioBytes),
    });
    const { res, send, setHeader } = makeRes();

    const controller = new TransformController();
    await controller.transform(
      { storagePath: 'raw/user-1/t1.wav', tempoPercent: -10 },
      { id: 'user-1' },
      res,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/transform',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav');
    expect(send).toHaveBeenCalledWith(Buffer.from(audioBytes));
  });

  it('rethrows the AI service error as an HttpException', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('bad file'),
    });
    const { res } = makeRes();

    const controller = new TransformController();
    await expect(
      controller.transform(
        { storagePath: 'raw/user-1/t1.wav' },
        { id: 'user-1' },
        res,
      ),
    ).rejects.toThrow(HttpException);
  });
});
