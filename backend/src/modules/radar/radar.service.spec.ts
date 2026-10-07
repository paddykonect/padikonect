/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { PrismaService } from '../../database/prisma.service';
import { RadarService } from './radar.service';

interface MakeOpts {
  nearby?: ReturnType<typeof liveRow>[];
  added?: string[];
  hid?: string[];
  ratings?: Array<{
    rateeId: string;
    _avg: { stars: number | null };
    _count: { _all: number };
  }>;
}

function liveRow(
  id: string,
  over: { online?: boolean; wants?: string | null } = {},
) {
  return {
    userId: id,
    latitude: 6.4,
    longitude: 3.4,
    updatedAt: new Date(),
    user: {
      id,
      fullName: `User ${id}`,
      lastSeenAt: over.online === false ? null : new Date(),
      profile: {
        displayName: `User ${id}`,
        photoUrl: null,
        wantsToBeInvitedFor: over.wants ?? null,
      },
    },
  };
}

function make(opts: MakeOpts = {}) {
  const prisma = {
    liveLocation: {
      upsert: jest.fn().mockResolvedValue({ updatedAt: new Date() }),
      findMany: jest.fn().mockResolvedValue(opts.nearby ?? []),
      deleteMany: jest.fn(),
    },
    padiConnection: {
      findMany: jest
        .fn()
        .mockResolvedValue((opts.added ?? []).map((padiId) => ({ padiId }))),
    },
    radarHide: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (opts.hid ?? []).map((hiddenFromId) => ({ hiddenFromId })),
        ),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    padiRating: { groupBy: jest.fn().mockResolvedValue(opts.ratings ?? []) },
  } as unknown as PrismaService;
  return { service: new RadarService(prisma), prisma };
}

describe('RadarService', () => {
  it('stores coordinates rounded to ~100m', async () => {
    const { service, prisma } = make();
    await service.share('me', 6.428149, 3.421934);
    expect(prisma.liveLocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'me', latitude: 6.428, longitude: 3.422 },
      }),
    );
  });

  it('returns fresh locations of people who added you, excluding those who hid from you', async () => {
    const { service, prisma } = make();
    await service.padisNearby('me');
    const [[args]] = (prisma.liveLocation.findMany as jest.Mock).mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    const where = args.where;
    expect(where.user).toMatchObject({
      padiConnections: { some: { padiId: 'me' } },
      radarHidesMade: { none: { hiddenFromId: 'me' } },
    });
    expect(where.userId).toEqual({ not: 'me' });
    expect(where.updatedAt).toHaveProperty('gt');
  });

  it('enriches each padi with online, message, rating, isPadi and hidden state', async () => {
    const { service } = make({
      nearby: [liveRow('femi', { wants: 'coffee' })],
      added: ['femi'],
      hid: ['femi'],
      ratings: [{ rateeId: 'femi', _avg: { stars: 4.5 }, _count: { _all: 2 } }],
    });
    const [p] = await service.padisNearby('me');
    expect(p.user.online).toBe(true);
    expect(p.user.wantsToBeInvitedFor).toBe('coffee');
    expect(p.isPadi).toBe(true);
    expect(p.hiddenFromThem).toBe(true);
    expect(p.ratingAvg).toBe(4.5);
    expect(p.ratingCount).toBe(2);
  });

  it('marks a padi offline when their lastSeenAt is stale', async () => {
    const { service } = make({ nearby: [liveRow('ada', { online: false })] });
    const [p] = await service.padisNearby('me');
    expect(p.user.online).toBe(false);
    expect(p.isPadi).toBe(false);
    expect(p.ratingAvg).toBeNull();
  });

  it('hide and unhide write/remove the RadarHide row', async () => {
    const { service, prisma } = make();
    await service.hide('me', 'femi');
    expect(prisma.radarHide.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'me', hiddenFromId: 'femi' },
      }),
    );
    await service.unhide('me', 'femi');
    expect(prisma.radarHide.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me', hiddenFromId: 'femi' },
    });
  });

  it('hiding yourself is a no-op', async () => {
    const { service, prisma } = make();
    await service.hide('me', 'me');
    expect(prisma.radarHide.upsert).not.toHaveBeenCalled();
  });

  it('stopping deletes the stored location', async () => {
    const { service, prisma } = make();
    await service.stop('me');
    expect(prisma.liveLocation.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me' },
    });
  });
});
