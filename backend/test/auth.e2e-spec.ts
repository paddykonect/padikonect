import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { clearMailhog, getLatestOtpCode } from './utils/mailhog';

function randomDigits(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++)
    out += Math.floor(Math.random() * 10).toString();
  return out;
}

function uniqueIdentity(tag: string) {
  const suffix = `${Date.now()}${randomDigits(4)}`.slice(-10);
  return {
    fullName: `Test ${tag}`,
    phone: `+234${suffix}`,
    email: `test.${tag}.${suffix}@example.com`,
    password: 'Sup3rSecret!',
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- getHttpServer() is typed `any` in @nestjs/testing
    httpServer = app.getHttpServer();
    await clearMailhog();
  });

  afterAll(async () => {
    await app.close();
  });

  async function signupAndVerify(tag: string) {
    const identity = uniqueIdentity(tag);
    const agent = request.agent(httpServer);

    const signupRes = await agent.post('/api/v1/auth/signup').send({
      fullName: identity.fullName,
      phone: identity.phone,
      email: identity.email,
      password: identity.password,
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(signupRes.status).toBe(201);
    const pendingToken = (signupRes.body as { data: { pendingToken: string } })
      .data.pendingToken;

    const code = await getLatestOtpCode(identity.email);
    const verifyRes = await agent
      .post('/api/v1/auth/otp/verify')
      .send({ pendingToken, code });
    expect(verifyRes.status).toBe(200);
    const body = verifyRes.body as {
      data: {
        accessToken: string;
        refreshToken: string;
        user: { id: string; status: string };
      };
    };
    expect(body.data.user.status).toBe('ACTIVE');

    return { agent, identity, ...body.data };
  }

  it('signup rejects an incorrect OTP with a remaining-attempts count, then succeeds with the correct code', async () => {
    const identity = uniqueIdentity('wrongotp');
    const signupRes = await request(httpServer)
      .post('/api/v1/auth/signup')
      .send({
        fullName: identity.fullName,
        phone: identity.phone,
        email: identity.email,
        password: identity.password,
        ageConfirmed: true,
        termsAccepted: true,
      });
    expect(signupRes.status).toBe(201);
    const pendingToken = (signupRes.body as { data: { pendingToken: string } })
      .data.pendingToken;

    const realCode = await getLatestOtpCode(identity.email);
    const wrongCode = realCode === '000000' ? '111111' : '000000';

    const wrongRes = await request(httpServer)
      .post('/api/v1/auth/otp/verify')
      .send({ pendingToken, code: wrongCode });
    expect(wrongRes.status).toBe(400);
    const wrongBody = wrongRes.body as {
      code: string;
      params: { remainingAttempts: number };
    };
    expect(wrongBody.code).toBe('OTP_INCORRECT');
    expect(wrongBody.params.remainingAttempts).toBe(4);

    const rightRes = await request(httpServer)
      .post('/api/v1/auth/otp/verify')
      .send({ pendingToken, code: realCode });
    expect(rightRes.status).toBe(200);
  });

  it('rejects signup with a phone/email that already belongs to an active account', async () => {
    const { identity } = await signupAndVerify('dupe');

    const dupeRes = await request(httpServer).post('/api/v1/auth/signup').send({
      fullName: 'Someone Else',
      phone: identity.phone,
      email: identity.email,
      password: 'AnotherPass1!',
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(dupeRes.status).toBe(409);
    expect((dupeRes.body as { code: string }).code).toBe('ACCOUNT_EXISTS');
  });

  it('login lockout: 5 failed attempts locks the account even against the correct password on the 6th try', async () => {
    const { identity } = await signupAndVerify('lockout');

    for (let i = 0; i < 5; i++) {
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ identifier: identity.email, password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect((res.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
    }

    const lockedRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ identifier: identity.email, password: identity.password });
    expect(lockedRes.status).toBe(429);
    expect((lockedRes.body as { code: string }).code).toBe('ACCOUNT_LOCKED');
  });

  it('full session lifecycle: login, refresh, refresh-token reuse detection, logout', async () => {
    const { identity } = await signupAndVerify('session');
    const agent = request.agent(httpServer);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ identifier: identity.email, password: identity.password });
    expect(loginRes.status).toBe(200);
    const loginBody = loginRes.body as {
      data: { accessToken: string; refreshToken: string };
    };
    const firstRefreshToken = loginBody.data.refreshToken;

    const refreshRes = await agent.post('/api/v1/auth/refresh').send({});
    expect(refreshRes.status).toBe(200);
    const refreshBody = refreshRes.body as {
      data: { accessToken: string; refreshToken: string };
    };
    expect(refreshBody.data.refreshToken).not.toBe(firstRefreshToken);

    // Replaying the pre-rotation token is a theft signal — the whole session is revoked.
    const reuseRes = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken });
    expect(reuseRes.status).toBe(401);
    expect((reuseRes.body as { code: string }).code).toBe(
      'REFRESH_TOKEN_REUSED',
    );

    // The rotated (newer) token is also dead now, since reuse detection revokes the session.
    const postRevokeRes = await agent.post('/api/v1/auth/refresh').send({});
    expect(postRevokeRes.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    const { identity } = await signupAndVerify('logout');
    const agent = request.agent(httpServer);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ identifier: identity.email, password: identity.password });
    expect(loginRes.status).toBe(200);

    const logoutRes = await agent.post('/api/v1/auth/logout').send({});
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await agent
      .post('/api/v1/auth/refresh')
      .send({});
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('direct access to logout-all without a bearer token is rejected', async () => {
    const res = await request(httpServer)
      .post('/api/v1/auth/logout-all')
      .send({});
    expect(res.status).toBe(401);
  });

  it('forgot-password → reset-password lets the user log in with the new password and locks out the old one', async () => {
    const { identity } = await signupAndVerify('reset');

    const forgotRes = await request(httpServer)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: identity.email });
    expect(forgotRes.status).toBe(200);
    const pendingToken = (forgotRes.body as { data: { pendingToken: string } })
      .data.pendingToken;

    const code = await getLatestOtpCode(identity.email);
    const newPassword = 'BrandNewPass1!';
    const resetRes = await request(httpServer)
      .post('/api/v1/auth/reset-password')
      .send({ pendingToken, code, newPassword });
    expect(resetRes.status).toBe(200);

    const oldPasswordLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ identifier: identity.email, password: identity.password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ identifier: identity.email, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
  });

  it('forgot-password returns the same response shape for a non-existent identifier (no enumeration)', async () => {
    const res = await request(httpServer)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'nobody-real-xyz@example.com' });
    expect(res.status).toBe(200);
    expect(
      (res.body as { data: { pendingToken: string } }).data.pendingToken,
    ).toBeDefined();
  });
});
