import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

function makeConfig(
  overrides: Partial<
    Record<
      'cloudinary.cloudName' | 'cloudinary.apiKey' | 'cloudinary.apiSecret',
      string | undefined
    >
  > = {},
) {
  const values: Record<string, string | undefined> = {
    'cloudinary.cloudName': 'demo-cloud',
    'cloudinary.apiKey': 'demo-key',
    'cloudinary.apiSecret': 'demo-secret',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('CloudinaryService', () => {
  it('throws MEDIA_UPLOAD_NOT_CONFIGURED when credentials are missing', () => {
    const service = new CloudinaryService(
      makeConfig({ 'cloudinary.apiSecret': undefined }),
    );
    expect(() => service.getSignedUploadParams('avatars')).toThrow(
      expect.objectContaining({ code: 'MEDIA_UPLOAD_NOT_CONFIGURED' }),
    );
  });

  it('produces a signature that independently verifies against the same params/secret', () => {
    const service = new CloudinaryService(makeConfig());
    const result = service.getSignedUploadParams(
      'avatars',
      'avatars/user-123',
      true,
    );

    const expectedSignature = cloudinary.utils.api_sign_request(
      {
        timestamp: result.timestamp,
        folder: 'avatars',
        public_id: 'avatars/user-123',
        overwrite: 'true',
      },
      'demo-secret',
    );

    expect(result.signature).toBe(expectedSignature);
    expect(result.cloudName).toBe('demo-cloud');
    expect(result.apiKey).toBe('demo-key');
  });

  it('produces a different signature when the public_id differs', () => {
    const service = new CloudinaryService(makeConfig());
    const a = service.getSignedUploadParams('avatars', 'avatars/user-1');
    const b = service.getSignedUploadParams('avatars', 'avatars/user-2');
    expect(a.signature).not.toBe(b.signature);
  });
});
