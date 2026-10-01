import { AccountStatus } from '@prisma/client';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { WebauthnService } from './webauthn.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

const mockGenerateRegistrationOptions = jest.mocked(
  generateRegistrationOptions,
);
const mockVerifyRegistrationResponse = jest.mocked(verifyRegistrationResponse);
const mockGenerateAuthenticationOptions = jest.mocked(
  generateAuthenticationOptions,
);
const mockVerifyAuthenticationResponse = jest.mocked(
  verifyAuthenticationResponse,
);

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+2348012345678',
    role: 'MEMBER',
    status: AccountStatus.ACTIVE,
    ...overrides,
  };
}

function makeCredentialRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cred-row-1',
    userId: 'user-1',
    credentialId: 'cred-abc',
    publicKey: Buffer.from('pk'),
    counter: BigInt(0),
    transports: ['internal'],
    deviceType: 'singleDevice',
    backedUp: false,
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  };
}

function makeService() {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeUser()),
      findFirst: jest.fn().mockResolvedValue(makeUser()),
      update: jest.fn().mockResolvedValue(makeUser()),
    },
    webauthnCredential: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        'webauthn.rpName': 'Paddykonect',
        'webauthn.rpId': 'localhost',
        'webauthn.origin': 'http://localhost:3001',
      };
      return values[key];
    }),
  };
  const sessions = {
    create: jest.fn().mockResolvedValue({
      refreshToken: 'refresh-token',
      session: { id: 'session-1', expiresAt: new Date() },
    }),
  };
  const tokens = {
    signAccessToken: jest.fn().mockReturnValue('access-token'),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const service = new WebauthnService(
    prisma as never,
    config as never,
    sessions as never,
    tokens as never,
    redis as never,
  );
  return { service, prisma, config, sessions, tokens, redis };
}

describe('WebauthnService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getRegistrationOptions', () => {
    it('excludes already-registered credentials and stores the challenge in Redis', async () => {
      const { service, prisma, redis } = makeService();
      prisma.webauthnCredential.findMany.mockResolvedValue([
        makeCredentialRow(),
      ]);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'chal-1',
      } as never);

      const result = await service.getRegistrationOptions('user-1');

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: [{ id: 'cred-abc', transports: ['internal'] }],
        }),
      );
      expect(redis.set).toHaveBeenCalledWith(
        'webauthn:reg:user-1',
        'chal-1',
        'EX',
        120,
      );
      expect(result).toEqual({ challenge: 'chal-1' });
    });
  });

  describe('verifyRegistration', () => {
    it('throws WEBAUTHN_CHALLENGE_EXPIRED when no challenge was stored', async () => {
      const { service, redis } = makeService();
      redis.get.mockResolvedValue(null);

      await expect(
        service.verifyRegistration('user-1', {} as never),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_CHALLENGE_EXPIRED' });
    });

    it('throws WEBAUTHN_VERIFICATION_FAILED when the library rejects', async () => {
      const { service, redis } = makeService();
      redis.get.mockResolvedValue('chal-1');
      mockVerifyRegistrationResponse.mockRejectedValue(new Error('bad sig'));

      await expect(
        service.verifyRegistration('user-1', {} as never),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_VERIFICATION_FAILED' });
    });

    it('throws WEBAUTHN_VERIFICATION_FAILED when verified is false', async () => {
      const { service, redis } = makeService();
      redis.get.mockResolvedValue('chal-1');
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: false,
      } as never);

      await expect(
        service.verifyRegistration('user-1', {} as never),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_VERIFICATION_FAILED' });
    });

    it('persists the credential and clears the challenge on success', async () => {
      const { service, prisma, redis } = makeService();
      redis.get.mockResolvedValue('chal-1');
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-abc',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      } as never);

      await service.verifyRegistration('user-1', {} as never);

      expect(prisma.webauthnCredential.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          credentialId: 'cred-abc',
          publicKey: Buffer.from([1, 2, 3]),
          counter: BigInt(0),
          transports: ['internal'],
          deviceType: 'singleDevice',
          backedUp: false,
        },
      });
      expect(redis.del).toHaveBeenCalledWith('webauthn:reg:user-1');
    });
  });

  describe('getAuthenticationOptions', () => {
    it('throws WEBAUTHN_NOT_ENROLLED when the account has no registered credentials', async () => {
      const { service, prisma } = makeService();
      prisma.webauthnCredential.findMany.mockResolvedValue([]);

      await expect(
        service.getAuthenticationOptions('ada@example.com'),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_NOT_ENROLLED' });
    });

    it('throws WEBAUTHN_NOT_ENROLLED when no account matches the identifier', async () => {
      const { service, prisma } = makeService();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getAuthenticationOptions('nobody@example.com'),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_NOT_ENROLLED' });
    });

    it('returns a flowId and stores the pending challenge in Redis', async () => {
      const { service, prisma, redis } = makeService();
      prisma.webauthnCredential.findMany.mockResolvedValue([
        makeCredentialRow(),
      ]);
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'chal-2',
      });

      const result = await service.getAuthenticationOptions('ada@example.com');

      expect(result.flowId).toEqual(expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(
        `webauthn:authflow:${result.flowId}`,
        JSON.stringify({ userId: 'user-1', challenge: 'chal-2' }),
        'EX',
        120,
      );
    });
  });

  describe('verifyAuthentication', () => {
    const meta = {};

    it('throws WEBAUTHN_CHALLENGE_EXPIRED when the flow is missing', async () => {
      const { service, redis } = makeService();
      redis.get.mockResolvedValue(null);

      await expect(
        service.verifyAuthentication('flow-1', {} as never, meta),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_CHALLENGE_EXPIRED' });
    });

    it('throws WEBAUTHN_VERIFICATION_FAILED when the credential does not belong to the flow user', async () => {
      const { service, prisma, redis } = makeService();
      redis.get.mockResolvedValue(
        JSON.stringify({ userId: 'user-1', challenge: 'chal-2' }),
      );
      prisma.webauthnCredential.findUnique.mockResolvedValue(
        makeCredentialRow({ userId: 'someone-else' }),
      );

      await expect(
        service.verifyAuthentication(
          'flow-1',
          { id: 'cred-abc' } as never,
          meta,
        ),
      ).rejects.toMatchObject({ code: 'WEBAUTHN_VERIFICATION_FAILED' });
    });

    it('rejects an inactive account after a valid assertion', async () => {
      const { service, prisma, redis } = makeService();
      redis.get.mockResolvedValue(
        JSON.stringify({ userId: 'user-1', challenge: 'chal-2' }),
      );
      prisma.webauthnCredential.findUnique.mockResolvedValue(
        makeCredentialRow(),
      );
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      } as never);
      prisma.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ status: AccountStatus.SUSPENDED }),
      );

      await expect(
        service.verifyAuthentication(
          'flow-1',
          { id: 'cred-abc' } as never,
          meta,
        ),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_ACTIVE' });
    });

    it('bumps the stored counter and issues tokens on success', async () => {
      const { service, prisma, redis, sessions, tokens } = makeService();
      redis.get.mockResolvedValue(
        JSON.stringify({ userId: 'user-1', challenge: 'chal-2' }),
      );
      prisma.webauthnCredential.findUnique.mockResolvedValue(
        makeCredentialRow(),
      );
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 7 },
      } as never);

      const result = await service.verifyAuthentication(
        'flow-1',
        { id: 'cred-abc' } as never,
        meta,
      );

      expect(prisma.webauthnCredential.update).toHaveBeenCalledWith({
        where: { id: 'cred-row-1' },
        data: { counter: BigInt(7), lastUsedAt: expect.any(Date) as Date },
      });
      expect(redis.del).toHaveBeenCalledWith('webauthn:authflow:flow-1');
      expect(sessions.create).toHaveBeenCalledWith('user-1', false, meta);
      expect(tokens.signAccessToken).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.user.id).toBe('user-1');
    });
  });
});
