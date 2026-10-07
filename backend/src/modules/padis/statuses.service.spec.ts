/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { PrismaService } from '../../database/prisma.service';
import { PadiRatingService } from './padi-rating.service';
import { PadisService } from './padis.service';
import { StatusesService } from './statuses.service';
import { BlocksService } from '../blocks/blocks.service';

function noBlocks() {
  return {
    hiddenUserIds: jest.fn().mockResolvedValue([]),
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    assertNotBlocked: jest.fn(),
  } as unknown as BlocksService;
}

function noRatings() {
  return {
    context: jest.fn().mockResolvedValue({
      ratingAvg: null,
      ratingCount: 0,
      canRate: false,
      rateableEventId: null,
      myRating: null,
    }),
  } as unknown as PadiRatingService;
}

const future = new Date(Date.now() + 60 * 60 * 1000);

function row(id: string, userId: string, minutesAgo: number, viewed: boolean) {
  return {
    id,
    userId,
    text: 'hi',
    imageUrl: null,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
    expiresAt: future,
    user: { id: userId, fullName: `User ${userId}`, profile: null },
    views: viewed ? [{ viewerId: 'me' }] : [],
  };
}

function makeService(opts: {
  statuses?: ReturnType<typeof row>[];
  padiIds?: string[];
  found?: { userId: string; expiresAt: Date } | null;
}) {
  const prisma = {
    padiStatus: {
      findMany: jest.fn().mockResolvedValue(opts.statuses ?? []),
      findUnique: jest.fn().mockResolvedValue(opts.found ?? null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'new', text: 'hi', imageUrl: null }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    statusView: { upsert: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
  const padis = {
    padiIds: jest.fn().mockResolvedValue(opts.padiIds ?? []),
  } as unknown as PadisService;
  return { service: new StatusesService(prisma, padis), prisma };
}

describe('StatusesService', () => {
  it('orders the feed: me first, then padis with unseen statuses, then seen', async () => {
    const { service } = makeService({
      padiIds: ['seen', 'unseen'],
      statuses: [
        row('s1', 'seen', 5, true),
        row('s2', 'unseen', 50, false),
        row('s3', 'me', 30, false),
      ],
    });
    const feed = await service.feed('me');
    expect(feed.map((g) => g.user.id)).toEqual(['me', 'unseen', 'seen']);
    expect(feed[0].isMe).toBe(true);
    expect(feed[0].statuses[0].viewed).toBe(true); // own statuses never "unseen"
    expect(feed[1].hasUnseen).toBe(true);
    expect(feed[2].hasUnseen).toBe(false);
    expect(feed[2].user.displayName).toBe('User seen');
  });

  it('rejects an empty status', async () => {
    const { service } = makeService({});
    await expect(service.create('me', { text: '   ' })).rejects.toThrow(
      /text or a photo/,
    );
  });

  it('prunes expired statuses when a new one is posted', async () => {
    const { service, prisma } = makeService({});
    await service.create('me', { text: 'pull up' });
    expect(prisma.padiStatus.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: expect.any(Date) as Date } },
    });
    expect(prisma.padiStatus.create).toHaveBeenCalled();
  });

  it("won't mark a non-padi's status as viewed", async () => {
    const { service, prisma } = makeService({
      padiIds: [],
      found: { userId: 'stranger', expiresAt: future },
    });
    await expect(service.markViewed('me', 's1')).rejects.toThrow(/not found/);
    expect(prisma.statusView.upsert).not.toHaveBeenCalled();
  });

  it("records a view on a padi's status", async () => {
    const { service, prisma } = makeService({
      padiIds: ['ada'],
      found: { userId: 'ada', expiresAt: future },
    });
    await service.markViewed('me', 's1');
    expect(prisma.statusView.upsert).toHaveBeenCalled();
  });
});

describe('PadisService', () => {
  it("can't add yourself", async () => {
    const service = new PadisService(
      {} as PrismaService,
      noBlocks(),
      noRatings(),
    );
    await expect(service.add('me', 'me')).rejects.toThrow(/yourself/);
  });
});

describe('PadisService.profile', () => {
  function make(myPadis: string[], theirPadis: string[]) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ada',
          fullName: 'Ada Obi',
          status: 'ACTIVE',
          createdAt: new Date('2026-03-01'),
          profile: {
            displayName: null,
            photoUrl: null,
            bio: 'hi',
            state: 'Lagos',
            country: 'Nigeria',
          },
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'zainab', fullName: 'Zainab', profile: null },
          ]),
      },
      padiConnection: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }: { where: { userId: string } }) =>
            Promise.resolve(
              (where.userId === 'me' ? myPadis : theirPadis).map((padiId) => ({
                padiId,
              })),
            ),
          ),
      },
      event: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      rsvp: { count: jest.fn().mockResolvedValue(1) },
      padiStatus: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 's1', text: 'yo', createdAt: new Date() }),
      },
      radarHide: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    return {
      service: new PadisService(prisma, noBlocks(), noRatings()),
      prisma,
    };
  }

  it('hides the active status until you have added them', async () => {
    const { service, prisma } = make([], ['zainab']);
    const view = await service.profile('me', 'ada');
    expect(view.isPadi).toBe(false);
    expect(view.activeStatus).toBeNull();
    expect(prisma.padiStatus.findFirst).not.toHaveBeenCalled();
    expect(view.location).toBe('Lagos, Nigeria');
  });

  it('shows status and mutual padis once added', async () => {
    const { service } = make(['ada', 'zainab'], ['zainab']);
    const view = await service.profile('me', 'ada');
    expect(view.isPadi).toBe(true);
    expect(view.activeStatus?.text).toBe('yo');
    expect(view.mutualPadis.map((p) => p.id)).toEqual(['zainab']);
  });
});
