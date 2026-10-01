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

describe('Webauthn (e2e)', () => {
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

  async function signupAndActivate() {
    const suffix = `${Date.now()}${randomDigits(4)}`.slice(-10);
    const email = `webauthn.test.${suffix}@example.com`;
    const phone = `+234${suffix}`;

    const signupRes = await request(httpServer).post('/api/v1/auth/signup').send({
      fullName: 'Webauthn Tester',
      phone,
      email,
      password: 'Sup3rSecret!',
      ageConfirmed: true,
      termsAccepted: true,
    });
    const pendingToken = (signupRes.body as { data: { pendingToken: string } })
      .data.pendingToken;
    const code = await getLatestOtpCode(email);
    const verifyRes = await request(httpServer)
      .post('/api/v1/auth/otp/verify')
      .send({ pendingToken, code });
    const body = verifyRes.body as {
      data: { accessToken: string; user: { id: string } };
    };
    return { accessToken: body.data.accessToken, email };
  }

  it('rejects unauthenticated access to registration/options', async () => {
    const res = await request(httpServer).post(
      '/api/v1/auth/webauthn/registration/options',
    );
    expect(res.status).toBe(401);
  });

  it('returns valid publicKey creation options for an authenticated user', async () => {
    const { accessToken } = await signupAndActivate();

    const res = await request(httpServer)
      .post('/api/v1/auth/webauthn/registration/options')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = (
      res.body as {
        data: {
          challenge: string;
          rp: { id: string; name: string };
          user: { name: string };
          excludeCredentials: unknown[];
        };
      }
    ).data;
    expect(data.challenge).toEqual(expect.any(String));
    expect(data.rp).toMatchObject({ id: 'localhost', name: 'Paddykonect' });
    expect(data.excludeCredentials).toEqual([]);
  });

  it('registration/verify rejects a garbage attestation response', async () => {
    const { accessToken } = await signupAndActivate();

    await request(httpServer)
      .post('/api/v1/auth/webauthn/registration/options')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(httpServer)
      .post('/api/v1/auth/webauthn/registration/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ response: { id: 'not-a-real-credential' } });
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe(
      'WEBAUTHN_VERIFICATION_FAILED',
    );
  });

  it('authentication/options returns WEBAUTHN_NOT_ENROLLED for an account with no registered credentials', async () => {
    const { email } = await signupAndActivate();

    const res = await request(httpServer)
      .post('/api/v1/auth/webauthn/authentication/options')
      .send({ identifier: email });
    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('WEBAUTHN_NOT_ENROLLED');
  });

  it('authentication/options returns the same not-enrolled response for a nonexistent identifier', async () => {
    const res = await request(httpServer)
      .post('/api/v1/auth/webauthn/authentication/options')
      .send({ identifier: 'nobody-real-xyz@example.com' });
    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('WEBAUTHN_NOT_ENROLLED');
  });
});
