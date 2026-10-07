import { PrismaService } from '../../database/prisma.service';

/**
 * How many hangouts the viewer shared with each of `userIds` — both were the
 * host or an approved/attended guest. Drives "5 mutual hangouts" on the
 * invite picker and request detail.
 */
export async function countMutualHangouts(
  prisma: PrismaService,
  viewerId: string,
  userIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;
  const rows = await prisma.$queryRaw<Array<{ userId: string; n: number }>>`
    WITH parts AS (
      SELECT "eventId", "userId" FROM "Rsvp" WHERE "status" IN ('APPROVED', 'ATTENDED')
      UNION
      SELECT "id" AS "eventId", "hostId" AS "userId" FROM "Event" WHERE "status" = 'PUBLISHED'
    )
    SELECT b."userId", COUNT(DISTINCT b."eventId")::int AS n
    FROM parts a JOIN parts b ON a."eventId" = b."eventId"
    WHERE a."userId" = ${viewerId} AND b."userId" = ANY(${userIds})
    GROUP BY b."userId"
  `;
  for (const r of rows) result.set(r.userId, r.n);
  return result;
}
