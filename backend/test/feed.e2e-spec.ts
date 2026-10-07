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

describe('Feed (e2e)', () => {
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
    const email = `feed.test.${suffix}@example.com`;
    const phone = `+234${suffix}`;

    const signupRes = await request(httpServer)
      .post('/api/v1/auth/signup')
      .send({
        fullName: 'Feed Tester',
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

  it('rejects unauthenticated access to the feed', async () => {
    const res = await request(httpServer).get('/api/v1/feed');
    expect(res.status).toBe(401);
  });

  it('rejects an empty post (no caption, no media)', async () => {
    const { accessToken } = await signupAndActivate();
    const res = await request(httpServer)
      .post('/api/v1/feed/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('POST_EMPTY');
  });

  it('creates a caption-only post and a media-only post', async () => {
    const { accessToken } = await signupAndActivate();

    const captionRes = await request(httpServer)
      .post('/api/v1/feed/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ caption: 'Great night out!' });
    expect(captionRes.status).toBe(201);
    const captionData = (
      captionRes.body as { data: { caption: string; media: unknown[] } }
    ).data;
    expect(captionData.caption).toBe('Great night out!');
    expect(captionData.media).toEqual([]);

    const mediaRes = await request(httpServer)
      .post('/api/v1/feed/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        media: [
          {
            url: 'https://res.cloudinary.com/demo/image/upload/v1/posts/x.jpg',
            publicId: 'posts/x',
            type: 'IMAGE',
          },
        ],
      });
    expect(mediaRes.status).toBe(201);
    const mediaData = (
      mediaRes.body as { data: { media: Array<{ url: string; type: string }> } }
    ).data;
    expect(mediaData.media).toHaveLength(1);
    expect(mediaData.media[0].type).toBe('IMAGE');
  });

  it('paginates the feed newest-first with a working cursor', async () => {
    const { accessToken } = await signupAndActivate();

    const ids: string[] = [];
    for (const caption of ['first', 'second', 'third']) {
      const res = await request(httpServer)
        .post('/api/v1/feed/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ caption });
      ids.push((res.body as { data: { id: string } }).data.id);
    }
    const [firstId, secondId, thirdId] = ids;

    const page1 = await request(httpServer)
      .get('/api/v1/feed?limit=2')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(page1.status).toBe(200);
    const page1Body = page1.body as {
      data: { items: Array<{ id: string }>; nextCursor: string | null };
    };
    expect(page1Body.data.items.map((p) => p.id)).toEqual([thirdId, secondId]);
    expect(page1Body.data.nextCursor).not.toBeNull();

    const page2 = await request(httpServer)
      .get(
        `/api/v1/feed?limit=2&cursor=${encodeURIComponent(page1Body.data.nextCursor as string)}`,
      )
      .set('Authorization', `Bearer ${accessToken}`);
    expect(page2.status).toBe(200);
    const page2Body = page2.body as { data: { items: Array<{ id: string }> } };
    expect(page2Body.data.items[0].id).toBe(firstId);
  });

  it('lets an owner delete their own post, and hides it from the feed afterward', async () => {
    const { accessToken } = await signupAndActivate();

    const createRes = await request(httpServer)
      .post('/api/v1/feed/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ caption: 'to be deleted' });
    const postId = (createRes.body as { data: { id: string } }).data.id;

    const deleteRes = await request(httpServer)
      .delete(`/api/v1/feed/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(200);

    const feedRes = await request(httpServer)
      .get('/api/v1/feed?limit=50')
      .set('Authorization', `Bearer ${accessToken}`);
    const feedBody = feedRes.body as { data: { items: Array<{ id: string }> } };
    expect(feedBody.data.items.map((p) => p.id)).not.toContain(postId);
  });

  it('rejects deleting a post that belongs to someone else', async () => {
    const owner = await signupAndActivate();
    const intruder = await signupAndActivate();

    const createRes = await request(httpServer)
      .post('/api/v1/feed/posts')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ caption: 'mine' });
    const postId = (createRes.body as { data: { id: string } }).data.id;

    const res = await request(httpServer)
      .delete(`/api/v1/feed/posts/${postId}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe('POST_NOT_OWNED');
  });

  it('deleting a nonexistent post returns 404', async () => {
    const { accessToken } = await signupAndActivate();
    const res = await request(httpServer)
      .delete('/api/v1/feed/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('media-upload-signature reports 503 until Cloudinary credentials are configured', async () => {
    const { accessToken } = await signupAndActivate();
    const res = await request(httpServer)
      .get('/api/v1/feed/media-upload-signature')
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 503]).toContain(res.status);
  });
});
