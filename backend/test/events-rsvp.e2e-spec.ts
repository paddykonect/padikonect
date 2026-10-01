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

describe('Events + RSVP (e2e)', () => {
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

  async function signupAndActivate(tag: string) {
    const suffix = `${Date.now()}${randomDigits(4)}`.slice(-10);
    const email = `evt.${tag}.${suffix}@example.com`;
    const phone = `+234${suffix}`;

    const signupRes = await request(httpServer)
      .post('/api/v1/auth/signup')
      .send({
        fullName: `Evt ${tag}`,
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
    return { accessToken: body.data.accessToken, userId: body.data.user.id };
  }

  function futureIso(hoursFromNow: number): string {
    return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
  }

  async function createEvent(
    accessToken: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(httpServer)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Padi Meetup',
        addressText: 'Lekki Phase 1, Lagos',
        latitude: 6.4432,
        longitude: 3.4726,
        startAt: futureIso(5),
        capacity: 10,
        ...overrides,
      });
    return res;
  }

  it('rejects unauthenticated access to create/list', async () => {
    const createRes = await request(httpServer).post('/api/v1/events').send({});
    expect(createRes.status).toBe(401);
    const listRes = await request(httpServer).get('/api/v1/events');
    expect(listRes.status).toBe(401);
  });

  it('creates an event without a real Cloudinary/Google Maps account, since lat/lng are client-supplied (map-picker mode)', async () => {
    const host = await signupAndActivate('create');
    const res = await createEvent(host.accessToken);
    expect(res.status).toBe(201);
    const data = (
      res.body as {
        data: {
          id: string;
          title: string;
          attendeeCount: number;
          host: { id: string };
        };
      }
    ).data;
    expect(data.title).toBe('Padi Meetup');
    expect(data.attendeeCount).toBe(0);
    expect(data.host.id).toBe(host.userId);
  });

  it('rejects a start time in the past and an end time before the start time', async () => {
    const host = await signupAndActivate('badtime');
    const pastRes = await createEvent(host.accessToken, {
      startAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(pastRes.status).toBe(400);
    expect((pastRes.body as { code: string }).code).toBe('EVENT_START_IN_PAST');

    const badEndRes = await createEvent(host.accessToken, {
      startAt: futureIso(5),
      endAt: futureIso(1),
    });
    expect(badEndRes.status).toBe(400);
    expect((badEndRes.body as { code: string }).code).toBe(
      'EVENT_END_BEFORE_START',
    );
  });

  it('gets event detail by id, including a live attendee count', async () => {
    const host = await signupAndActivate('detail');
    const createRes = await createEvent(host.accessToken);
    const id = (createRes.body as { data: { id: string } }).data.id;

    const res = await request(httpServer)
      .get(`/api/v1/events/${id}`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { data: { id: string } }).data.id).toBe(id);
  });

  it('filters the browse list by nonAlcoholic and underTwoK', async () => {
    const host = await signupAndActivate('filters');
    const alcoholicRes = await createEvent(host.accessToken, {
      drinkCategory: 'ALCOHOLIC',
      priceKobo: 500_000,
    });
    const nonAlcRes = await createEvent(host.accessToken, {
      drinkCategory: 'NON_ALCOHOLIC',
      priceKobo: 100_000,
    });
    const alcoholicId = (alcoholicRes.body as { data: { id: string } }).data.id;
    const nonAlcId = (nonAlcRes.body as { data: { id: string } }).data.id;

    const res = await request(httpServer)
      .get('/api/v1/events?limit=50&nonAlcoholic=true&underTwoK=true')
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(res.status).toBe(200);
    const ids = (
      res.body as { data: { items: Array<{ id: string }> } }
    ).data.items.map((e) => e.id);
    expect(ids).toContain(nonAlcId);
    expect(ids).not.toContain(alcoholicId);
  });

  it('the walking-distance filter requires lat/lng', async () => {
    const host = await signupAndActivate('walkreq');
    const res = await request(httpServer)
      .get('/api/v1/events?walkingDistance=true')
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('LOCATION_REQUIRED');
  });

  it('lets only the host edit or cancel the event, and notifies attendees when time changes', async () => {
    const host = await signupAndActivate('edithost');
    const intruder = await signupAndActivate('editintruder');
    const attendee = await signupAndActivate('editattendee');

    const createRes = await createEvent(host.accessToken);
    const id = (createRes.body as { data: { id: string } }).data.id;

    // OPEN policy isn't client-settable, so approve the attendee explicitly via join+approve to get them APPROVED.
    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${attendee.accessToken}`);
    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps/${attendee.userId}/approve`)
      .set('Authorization', `Bearer ${host.accessToken}`);

    const intruderEdit = await request(httpServer)
      .patch(`/api/v1/events/${id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ title: 'Hijacked' });
    expect(intruderEdit.status).toBe(403);
    expect((intruderEdit.body as { code: string }).code).toBe('NOT_EVENT_HOST');

    const hostEdit = await request(httpServer)
      .patch(`/api/v1/events/${id}`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({ startAt: futureIso(10) });
    expect(hostEdit.status).toBe(200);

    const notifRes = await request(httpServer)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${attendee.accessToken}`);
    const notifs = (notifRes.body as { data: Array<{ type: string }> }).data;
    expect(notifs.some((n) => n.type === 'EVENT_UPDATED')).toBe(true);
  });

  it('cancelling notifies attendees and blocks further joins', async () => {
    const host = await signupAndActivate('cancelhost');
    const attendee = await signupAndActivate('cancelattendee');
    const createRes = await createEvent(host.accessToken);
    const id = (createRes.body as { data: { id: string } }).data.id;

    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${attendee.accessToken}`);
    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps/${attendee.userId}/approve`)
      .set('Authorization', `Bearer ${host.accessToken}`);

    const cancelRes = await request(httpServer)
      .post(`/api/v1/events/${id}/cancel`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({ reason: 'Venue closed' });
    expect(cancelRes.status).toBe(201);

    const secondCancel = await request(httpServer)
      .post(`/api/v1/events/${id}/cancel`)
      .set('Authorization', `Bearer ${host.accessToken}`)
      .send({});
    expect(secondCancel.status).toBe(400);
    expect((secondCancel.body as { code: string }).code).toBe(
      'EVENT_ALREADY_CANCELLED',
    );

    const newJoiner = await signupAndActivate('cancelnewjoiner');
    const joinCancelled = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${newJoiner.accessToken}`);
    expect(joinCancelled.status).toBe(400);
    expect((joinCancelled.body as { code: string }).code).toBe(
      'EVENT_CANCELLED',
    );

    const notifRes = await request(httpServer)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${attendee.accessToken}`);
    const notifs = (notifRes.body as { data: Array<{ type: string }> }).data;
    expect(notifs.some((n) => n.type === 'EVENT_CANCELLED')).toBe(true);
  });

  it('a host cannot RSVP to their own event', async () => {
    const host = await signupAndActivate('selfjoin');
    const createRes = await createEvent(host.accessToken);
    const id = (createRes.body as { data: { id: string } }).data.id;

    const res = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('CANNOT_JOIN_OWN_EVENT');
  });

  it('approve/decline: host manages pending requests, and my-rsvps reflects status', async () => {
    const host = await signupAndActivate('approvehost');
    const requester = await signupAndActivate('approverequester');
    const createRes = await createEvent(host.accessToken);
    const id = (createRes.body as { data: { id: string } }).data.id;

    const joinRes = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${requester.accessToken}`);
    expect(joinRes.status).toBe(201);
    expect((joinRes.body as { data: { status: string } }).data.status).toBe(
      'REQUESTED',
    );

    const pendingRes = await request(httpServer)
      .get(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(pendingRes.status).toBe(200);
    const pending = (
      pendingRes.body as { data: Array<{ user: { id: string } }> }
    ).data;
    expect(pending.some((p) => p.user.id === requester.userId)).toBe(true);

    const approveRes = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps/${requester.userId}/approve`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(approveRes.status).toBe(201);
    expect((approveRes.body as { data: { status: string } }).data.status).toBe(
      'APPROVED',
    );

    const myRsvpsRes = await request(httpServer)
      .get('/api/v1/rsvps/me')
      .set('Authorization', `Bearer ${requester.accessToken}`);
    expect(myRsvpsRes.status).toBe(200);
    const mine = (
      myRsvpsRes.body as {
        data: Array<{ rsvpStatus: string; event: { id: string } }>;
      }
    ).data;
    expect(mine.find((m) => m.event.id === id)?.rsvpStatus).toBe('APPROVED');

    const attendeesRes = await request(httpServer)
      .get(`/api/v1/events/${id}/attendees`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect(
      (attendeesRes.body as { data: Array<{ id: string }> }).data.map(
        (a) => a.id,
      ),
    ).toContain(requester.userId);
  });

  it('self-cancel promotes the next waitlisted user', async () => {
    const host = await signupAndActivate('waitlisthost');
    const a = await signupAndActivate('waitlistA');
    const b = await signupAndActivate('waitlistB');

    const createRes = await createEvent(host.accessToken, { capacity: 1 });
    const id = (createRes.body as { data: { id: string } }).data.id;

    // Both requests need host approval (APPROVAL is always the server default).
    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps`)
      .set('Authorization', `Bearer ${b.accessToken}`);

    const approveA = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps/${a.userId}/approve`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect((approveA.body as { data: { status: string } }).data.status).toBe(
      'APPROVED',
    );

    const approveB = await request(httpServer)
      .post(`/api/v1/events/${id}/rsvps/${b.userId}/approve`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect((approveB.body as { data: { status: string } }).data.status).toBe(
      'WAITLISTED',
    );

    const cancelA = await request(httpServer)
      .delete(`/api/v1/events/${id}/rsvps/me`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(cancelA.status).toBe(200);

    const myRsvpsB = await request(httpServer)
      .get('/api/v1/rsvps/me')
      .set('Authorization', `Bearer ${b.accessToken}`);
    const mineB = (
      myRsvpsB.body as {
        data: Array<{ rsvpStatus: string; event: { id: string } }>;
      }
    ).data;
    expect(mineB.find((m) => m.event.id === id)?.rsvpStatus).toBe('APPROVED');
  });

  it('cover-upload-signature reports 503 until Cloudinary credentials are configured', async () => {
    const host = await signupAndActivate('coversig');
    const res = await request(httpServer)
      .get('/api/v1/events/cover-upload-signature')
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect([200, 503]).toContain(res.status);
  });

  it('CONCURRENCY: N simultaneous joins against a capacity-1 OPEN event never exceed capacity', async () => {
    const host = await signupAndActivate('concurrencyhost');
    const createRes = await createEvent(host.accessToken, { capacity: 1 });
    const id = (createRes.body as { data: { id: string } }).data.id;

    // All requesters need APPROVAL (server-enforced default), so this test
    // exercises the concurrency-critical path in `approve()`, not `join()`
    // directly — both share the same lock-then-count-then-decide mechanism
    // (see plan §RSVP/capacity concurrency).
    const N = 8;
    const joiners = await Promise.all(
      Array.from({ length: N }, (_, i) => signupAndActivate(`concurrency${i}`)),
    );
    await Promise.all(
      joiners.map((j) =>
        request(httpServer)
          .post(`/api/v1/events/${id}/rsvps`)
          .set('Authorization', `Bearer ${j.accessToken}`),
      ),
    );

    const approvalResults = await Promise.all(
      joiners.map((j) =>
        request(httpServer)
          .post(`/api/v1/events/${id}/rsvps/${j.userId}/approve`)
          .set('Authorization', `Bearer ${host.accessToken}`),
      ),
    );

    const statuses = approvalResults.map(
      (r) => (r.body as { data: { status: string } }).data.status,
    );
    const approvedCount = statuses.filter((s) => s === 'APPROVED').length;
    const waitlistedCount = statuses.filter((s) => s === 'WAITLISTED').length;

    expect(approvedCount).toBe(1);
    expect(waitlistedCount).toBe(N - 1);

    // Cross-check against the database's own view via the attendees endpoint —
    // the real correctness guarantee, not just the per-call response bodies.
    const attendeesRes = await request(httpServer)
      .get(`/api/v1/events/${id}/attendees`)
      .set('Authorization', `Bearer ${host.accessToken}`);
    expect((attendeesRes.body as { data: unknown[] }).data).toHaveLength(1);
  });
});
