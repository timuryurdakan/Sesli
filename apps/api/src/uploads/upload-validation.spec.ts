import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_STORAGE_QUOTA_BYTES,
  getMaxUploadBytes,
  getStorageQuotaBytes,
  isAllowedMimeType,
  wouldExceedStorageQuota,
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

describe('getStorageQuotaBytes', () => {
  const original = process.env.MAX_STORAGE_BYTES_PER_USER;

  afterEach(() => {
    process.env.MAX_STORAGE_BYTES_PER_USER = original;
  });

  it('falls back to the default when unset', () => {
    delete process.env.MAX_STORAGE_BYTES_PER_USER;
    expect(getStorageQuotaBytes()).toBe(DEFAULT_STORAGE_QUOTA_BYTES);
  });

  it('uses a valid configured value', () => {
    process.env.MAX_STORAGE_BYTES_PER_USER = '5000';
    expect(getStorageQuotaBytes()).toBe(5000);
  });
});

describe('wouldExceedStorageQuota', () => {
  it('allows usage that stays within quota', () => {
    expect(wouldExceedStorageQuota(300, 400, 1000)).toBe(false);
  });

  it('allows usage that exactly meets quota', () => {
    expect(wouldExceedStorageQuota(600, 400, 1000)).toBe(false);
  });

  it('rejects usage that would exceed quota', () => {
    expect(wouldExceedStorageQuota(500, 600, 1000)).toBe(true);
  });
});
