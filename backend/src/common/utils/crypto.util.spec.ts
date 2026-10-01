import {
  generateOpaqueToken,
  generateOtpCode,
  hmacSha256Hex,
} from './crypto.util';

describe('crypto.util', () => {
  describe('hmacSha256Hex', () => {
    it('is deterministic for the same value and secret', () => {
      expect(hmacSha256Hex('123456', 'pepper')).toBe(
        hmacSha256Hex('123456', 'pepper'),
      );
    });

    it('differs when the secret differs', () => {
      expect(hmacSha256Hex('123456', 'pepper-a')).not.toBe(
        hmacSha256Hex('123456', 'pepper-b'),
      );
    });

    it('differs when the value differs', () => {
      expect(hmacSha256Hex('111111', 'pepper')).not.toBe(
        hmacSha256Hex('222222', 'pepper'),
      );
    });
  });

  describe('generateOtpCode', () => {
    it('always returns a 6-digit numeric string, zero-padded', () => {
      for (let i = 0; i < 200; i++) {
        const code = generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('generateOpaqueToken', () => {
    it('returns a hex string of the expected length and is not predictable across calls', () => {
      const a = generateOpaqueToken(48);
      const b = generateOpaqueToken(48);
      expect(a).toMatch(/^[0-9a-f]+$/);
      expect(a).toHaveLength(96);
      expect(a).not.toBe(b);
    });
  });
});
