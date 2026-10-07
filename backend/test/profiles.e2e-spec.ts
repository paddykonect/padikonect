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

describe('Profiles (e2e)', () => {
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
    const email = `profile.test.${suffix}@example.com`;
    const phone = `+234${suffix}`;

    const signupRes = await request(httpServer)
      .post('/api/v1/auth/signup')
      .send({
        fullName: 'Profile Tester',
        phone,
        email,
        password: 'Sup3rSecret!',
        dateOfBirth: '1995-06-15',
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
    return { accessToken: body.data.accessToken, userId: body.data.user.id };
  }

  it('rejects unauthenticated access to the own-profile endpoint', async () => {
    const res = await request(httpServer).get('/api/v1/profiles/me');
    expect(res.status).toBe(401);
  });

  it('returns default values for a freshly created profile', async () => {
    const { accessToken } = await signupAndActivate();

    const res = await request(httpServer)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      displayName: null,
      photoUrl: null,
      bio: null,
      drinkPreference: 'BOTH',
      interests: [],
      membershipStatus: 'FREE',
      padiPoints: 0,
      hostedCount: 0,
      attendedCount: 0,
    });
  });

  it('updates the Taste Picker fields (drink preference + interests) and other profile fields', async () => {
    const { accessToken } = await signupAndActivate();

    const res = await request(httpServer)
      .patch('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Ada',
        bio: 'Loves suya',
        drinkPreference: 'NON_ALCOHOLIC',
        interests: ['music', 'football'],
      });

    expect(res.status).toBe(200);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      displayName: 'Ada',
      bio: 'Loves suya',
      drinkPreference: 'NON_ALCOHOLIC',
      interests: ['music', 'football'],
    });
  });

  it('rejects more than 10 interests', async () => {
    const { accessToken } = await signupAndActivate();
    const tooMany = Array.from({ length: 11 }, (_, i) => `tag${i}`);

    const res = await request(httpServer)
      .patch('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ interests: tooMany });

    expect(res.status).toBe(400);
  });

  it('a public profile view omits padiPoints', async () => {
    const { accessToken, userId } = await signupAndActivate();
    await request(httpServer)
      .patch('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Public Ada' });

    const res = await request(httpServer)
      .get(`/api/v1/profiles/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data.displayName).toBe('Public Ada');
    expect(data).not.toHaveProperty('padiPoints');
  });

  it('returns 404 for a profile that was never created', async () => {
    const { accessToken } = await signupAndActivate();
    const res = await request(httpServer)
      .get('/api/v1/profiles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('PROFILE_NOT_FOUND');
  });

  it('avatar upload signature endpoint reports 503 until Cloudinary credentials are configured', async () => {
    const { accessToken } = await signupAndActivate();
    const res = await request(httpServer)
      .get('/api/v1/profiles/me/avatar-upload-signature')
      .set('Authorization', `Bearer ${accessToken}`);
    // This test environment has no real Cloudinary account configured yet —
    // once CLOUDINARY_* is set in .env this will start returning 200 instead.
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect((res.body as { code: string }).code).toBe(
        'MEDIA_UPLOAD_NOT_CONFIGURED',
      );
    }
  });
});
