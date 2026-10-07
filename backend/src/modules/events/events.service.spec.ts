/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock.calls */
import { GeoRepository } from '../../database/geo/geo.repository';
import { PrismaService } from '../../database/prisma.service';
import { GoogleMapsService } from '../../integrations/google-maps/google-maps.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from './events.service';
import { BlocksService } from '../blocks/blocks.service';

function noBlocks() {
  return {
    hiddenUserIds: jest.fn().mockResolvedValue([]),
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    assertNotBlocked: jest.fn(),
  } as unknown as BlocksService;
}

function baseEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    hostId: 'host-1',
    title: 'Padi Meetup',
    description: null,
    addressText: 'Lekki Phase 1',
    latitude: 6.43,
    longitude: 3.45,
    startAt: new Date(Date.now() + 3600_000),
    endAt: null,
    capacity: 10,
    priceKobo: null,
    coverImageUrl: null,
    coverImagePublicId: null,
    joinPolicy: 'APPROVAL',
    privacy: 'PUBLIC',
    drinkCategory: 'BOTH',
    status: 'PUBLISHED',
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    host: { id: 'host-1', profile: { displayName: 'Host', photoUrl: null } },
    _count: { rsvps: 3 },
    ...overrides,
  };
}

function makeService() {
  const prisma = {
    event: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rsvp: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    padiConnection: { findMany: jest.fn().mockResolvedValue([]) },
    eventFavorite: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      cb({
        event: {
          create: jest.fn().mockResolvedValue(baseEventRow()),
          update: jest.fn(),
        },
        conversation: { create: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
        conversationParticipant: { create: jest.fn() },
      }),
    ),
  } as unknown as PrismaService;
  const geo = {
    syncEventLocation: jest.fn(),
    findNearbyPublishedEventIds: jest.fn(),
  } as unknown as GeoRepository;
  const googleMaps = {
    geocodeAddress: jest.fn(),
  } as unknown as GoogleMapsService;
  const notifications = {
    notifyMany: jest.fn(),
  } as unknown as NotificationsService;
  return {
    service: new EventsService(
      prisma,
      geo,
      googleMaps,
      notifications,
      noBlocks(),
    ),
    prisma,
    geo,
    googleMaps,
    notifications,
  };
}

describe('EventsService', () => {
  describe('create', () => {
    it('rejects a start time in the past', async () => {
      const { service } = makeService();
      await expect(
        service.create('host-1', {
          title: 'x',
          addressText: 'y',
          startAt: new Date(Date.now() - 1000).toISOString(),
          capacity: 5,
          latitude: 1,
          longitude: 1,
        }),
      ).rejects.toMatchObject({ code: 'EVENT_START_IN_PAST' });
    });

    it('rejects an end time before the start time', async () => {
      const { service } = makeService();
      const start = new Date(Date.now() + 3600_000);
      const end = new Date(Date.now() + 1000);
      await expect(
        service.create('host-1', {
          title: 'x',
          addressText: 'y',
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          capacity: 5,
          latitude: 1,
          longitude: 1,
        }),
      ).rejects.toMatchObject({ code: 'EVENT_END_BEFORE_START' });
    });

    it('geocodes the address when lat/lng are not supplied', async () => {
      const { service, googleMaps } = makeService();
      (googleMaps.geocodeAddress as jest.Mock).mockResolvedValue({
        latitude: 6.4,
        longitude: 3.4,
      });

      await service.create('host-1', {
        title: 'x',
        addressText: 'Lekki',
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 5,
      });

      expect(googleMaps.geocodeAddress).toHaveBeenCalledWith('Lekki');
    });

    it('skips geocoding when lat/lng are supplied (map-picker mode)', async () => {
      const { service, googleMaps } = makeService();
      await service.create('host-1', {
        title: 'x',
        addressText: 'Lekki',
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        capacity: 5,
        latitude: 6.4,
        longitude: 3.4,
      });
      expect(googleMaps.geocodeAddress).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('requires lat/lng when the walkingDistance filter is active', async () => {
      const { service } = makeService();
      await expect(
        service.list({ limit: 20, walkingDistance: true }),
      ).rejects.toMatchObject({ code: 'LOCATION_REQUIRED' });
    });

    it('returns an empty page without querying events when no candidates are nearby', async () => {
      const { service, geo, prisma } = makeService();
      (geo.findNearbyPublishedEventIds as jest.Mock).mockResolvedValue([]);
      const page = await service.list({
        limit: 20,
        walkingDistance: true,
        lat: 6.4,
        lng: 3.4,
      });
      expect(page).toEqual({ items: [], nextCursor: null });
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('filters to non-alcoholic-or-both when nonAlcoholic is set', async () => {
      const { service, prisma } = makeService();
      await service.list({ limit: 20, nonAlcoholic: true });
      const call = (prisma.event.findMany as jest.Mock).mock.calls[0][0] as {
        where: { drinkCategory: unknown };
      };
      expect(call.where.drinkCategory).toEqual({
        in: ['NON_ALCOHOLIC', 'BOTH'],
      });
    });
  });

  describe('list search and Today', () => {
    it('searches title and area case-insensitively alongside Under ₦2k', async () => {
      const { service, prisma } = makeService();
      await service.list({ limit: 20, q: 'roof', underTwoK: true });
      const call = (prisma.event.findMany as jest.Mock).mock.calls[0][0] as {
        where: { AND: unknown[] };
      };
      expect(call.where.AND).toEqual([
        { OR: [{ priceKobo: null }, { priceKobo: { lte: 200_000 } }] },
        {
          OR: [
            { title: { contains: 'roof', mode: 'insensitive' } },
            { addressText: { contains: 'roof', mode: 'insensitive' } },
          ],
        },
      ]);
    });

    it('caps Today at the end of the Lagos day', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-02T20:30:00Z'));
      try {
        const { service, prisma } = makeService();
        await service.list({ limit: 20, today: true });
        const call = (prisma.event.findMany as jest.Mock).mock.calls[0][0] as {
          where: { startAt: { lte: Date } };
        };
        // 21:30 WAT -> midnight WAT is 22:59:59.999Z.
        expect(call.where.startAt.lte.toISOString()).toBe(
          '2026-10-02T22:59:59.999Z',
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("adds the viewer's RSVP status and padis-going count", async () => {
      const { service, prisma } = makeService();
      (prisma.event.findMany as jest.Mock).mockResolvedValue([baseEventRow()]);
      (prisma.rsvp.findMany as jest.Mock).mockResolvedValue([
        { eventId: 'event-1', status: 'REQUESTED' },
      ]);
      (prisma.padiConnection.findMany as jest.Mock).mockResolvedValue([
        { padiId: 'padi-1' },
        { padiId: 'padi-2' },
      ]);
      (prisma.rsvp.groupBy as jest.Mock).mockResolvedValue([
        { eventId: 'event-1', _count: { _all: 2 } },
      ]);
      const page = await service.list({ limit: 20 }, 'viewer-1');
      expect(page.items[0]).toMatchObject({
        myRsvpStatus: 'REQUESTED',
        padiCount: 2,
      });
    });

    it('treats a cancelled RSVP as not joined', async () => {
      const { service, prisma } = makeService();
      (prisma.event.findMany as jest.Mock).mockResolvedValue([baseEventRow()]);
      (prisma.rsvp.findMany as jest.Mock).mockResolvedValue([
        { eventId: 'event-1', status: 'CANCELLED' },
      ]);
      const page = await service.list({ limit: 20 }, 'viewer-1');
      expect(page.items[0].myRsvpStatus).toBeNull();
    });
  });

  describe('getById', () => {
    it('shows the host their pending request count', async () => {
      const { service, prisma } = makeService();
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(baseEventRow());
      (prisma.rsvp.count as jest.Mock).mockResolvedValue(3);
      const detail = await service.getById('event-1', 'host-1');
      expect(detail).toMatchObject({ isHost: true, pendingRequestCount: 3 });
    });

    it('never shows request counts to other users', async () => {
      const { service, prisma } = makeService();
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(baseEventRow());
      (prisma.rsvp.count as jest.Mock).mockResolvedValue(3);
      const detail = await service.getById('event-1', 'someone-else');
      expect(detail).toMatchObject({ isHost: false, pendingRequestCount: 0 });
      expect(prisma.rsvp.count).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('rejects cancelling an already-cancelled event', async () => {
      const { service, prisma } = makeService();
      (prisma.event.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        baseEventRow({ status: 'CANCELLED' }),
      );
      await expect(service.cancel('event-1', {})).rejects.toMatchObject({
        code: 'EVENT_ALREADY_CANCELLED',
      });
    });

    it('notifies every requested/waitlisted/approved/attended RSVP holder', async () => {
      const { service, prisma, notifications } = makeService();
      (prisma.event.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        baseEventRow(),
      );
      (prisma.event.update as jest.Mock).mockResolvedValue(
        baseEventRow({ status: 'CANCELLED' }),
      );
      (prisma.rsvp.findMany as jest.Mock).mockResolvedValue([
        { userId: 'a' },
        { userId: 'b' },
      ]);

      await service.cancel('event-1', { reason: 'rain' });

      expect(notifications.notifyMany).toHaveBeenCalledWith(
        ['a', 'b'],
        'EVENT_CANCELLED',
        expect.any(String),
        'rain',
        {
          eventId: 'event-1',
        },
      );
    });
  });
});
