import {
  DEFAULT_MAX_UPLOAD_BYTES,
  getMaxUploadBytes,
  isAllowedMimeType,
} from './upload-validation';

describe('isAllowedMimeType', () => {
  it('accepts known audio/video mime types', () => {
    expect(isAllowedMimeType('audio/mpeg')).toBe(true);
    expect(isAllowedMimeType('audio/wav')).toBe(true);
    expect(isAllowedMimeType('video/mp4')).toBe(true);
  });

  it('rejects unknown or spoofed mime types', () => {
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
    expect(isAllowedMimeType('text/html')).toBe(false);
    expect(isAllowedMimeType(undefined)).toBe(false);
  });
});

describe('getMaxUploadBytes', () => {
  const original = process.env.UPLOAD_MAX_BYTES;

  afterEach(() => {
    process.env.UPLOAD_MAX_BYTES = original;
  });

  it('falls back to the default when unset', () => {
    delete process.env.UPLOAD_MAX_BYTES;
    expect(getMaxUploadBytes()).toBe(DEFAULT_MAX_UPLOAD_BYTES);
  });

  it('falls back to the default when invalid', () => {
    process.env.UPLOAD_MAX_BYTES = 'not-a-number';
    expect(getMaxUploadBytes()).toBe(DEFAULT_MAX_UPLOAD_BYTES);
  });

  it('uses a valid configured value', () => {
    process.env.UPLOAD_MAX_BYTES = '1000';
    expect(getMaxUploadBytes()).toBe(1000);
  });
});
