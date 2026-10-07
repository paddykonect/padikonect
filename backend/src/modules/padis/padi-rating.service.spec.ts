/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { PrismaService } from '../../database/prisma.service';
import { PadiRatingService } from './padi-rating.service';

interface MakeOpts {
  sharedEventId?: string | null;
  myStars?: number | null;
  ratings?: Array<{
    rateeId: string;
    _avg: { stars: number | null };
    _count: { _all: number };
  }>;
}

function make(opts: MakeOpts = {}) {
  const prisma = {
    event: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.sharedEventId ? { id: opts.sharedEventId } : null,
        ),
    },
    padiRating: {
      groupBy: jest.fn().mockResolvedValue(opts.ratings ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.myStars != null ? { stars: opts.myStars } : null,
        ),
      upsert: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
  return { service: new PadiRatingService(prisma), prisma };
}

describe('PadiRatingService', () => {
  it('rejects rating yourself', async () => {
    const { service } = make({ sharedEventId: 'e1' });
    await expect(service.rate('me', 'me', 'e1', 5)).rejects.toMatchObject({
      code: 'CANNOT_RATE_SELF',
    });
  });

  it('rejects a rating when there is no shared, started hangout', async () => {
    const { service } = make({ sharedEventId: null });
    await expect(service.rate('me', 'ada', 'e1', 5)).rejects.toMatchObject({
      code: 'RATING_NOT_ALLOWED',
    });
  });

  it('upserts the rating when the hangout is shared', async () => {
    const { service, prisma } = make({ sharedEventId: 'e1' });
    await service.rate('me', 'ada', 'e1', 4);
    expect(prisma.padiRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { raterId: 'me', rateeId: 'ada', eventId: 'e1', stars: 4 },
        update: { stars: 4 },
      }),
    );
  });

  it('context returns the average, count, and whether the viewer can rate', async () => {
    const { service } = make({
      sharedEventId: 'e1',
      myStars: 5,
      ratings: [{ rateeId: 'ada', _avg: { stars: 4 }, _count: { _all: 3 } }],
    });
    const ctx = await service.context('me', 'ada');
    expect(ctx).toEqual({
      ratingAvg: 4,
      ratingCount: 3,
      canRate: true,
      rateableEventId: 'e1',
      myRating: 5,
    });
  });

  it('cannot rate yourself (no rateable event)', async () => {
    const { service, prisma } = make({ sharedEventId: 'e1' });
    expect(await service.rateableEventId('me', 'me')).toBeNull();
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });
});
