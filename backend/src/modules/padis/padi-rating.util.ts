import { PrismaService } from '../../database/prisma.service';

export interface RatingSummary {
  // Average stars (1 decimal), or null when the padi has no ratings yet.
  ratingAvg: number | null;
  ratingCount: number;
}

export const EMPTY_RATING: RatingSummary = { ratingAvg: null, ratingCount: 0 };

// Average + count of ratings received, keyed by ratee id. One groupBy for a
// whole list of padis (radar/list/profile all reuse this).
export async function ratingSummary(
  prisma: PrismaService,
  rateeIds: string[],
): Promise<Map<string, RatingSummary>> {
  const map = new Map<string, RatingSummary>();
  if (rateeIds.length === 0) return map;
  const rows = await prisma.padiRating.groupBy({
    by: ['rateeId'],
    where: { rateeId: { in: rateeIds } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    map.set(r.rateeId, {
      ratingAvg:
        r._avg.stars === null ? null : Math.round(r._avg.stars * 10) / 10,
      ratingCount: r._count._all,
    });
  }
  return map;
}
