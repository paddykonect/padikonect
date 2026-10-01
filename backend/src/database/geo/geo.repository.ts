import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Raw-SQL PostGIS helpers. Event.location is a Prisma `Unsupported` geometry
 * column — Prisma Client can never read/write it directly, so every geo
 * write/read goes through here instead.
 */
@Injectable()
export class GeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Must be called within the same transaction as the lat/lng write it follows. */
  async syncEventLocation(
    tx: Prisma.TransactionClient,
    eventId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Event"
      SET "location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
      WHERE "id" = ${eventId}
    `;
  }

  /** Nearest-first event ids within `radiusMeters`, capped at `limit` candidates. */
  async findNearbyPublishedEventIds(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Event"
      WHERE "status" = 'PUBLISHED'
        AND "location" IS NOT NULL
        AND ST_DWithin(
          "location"::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "location" <-> ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
      LIMIT ${limit}
    `;
    return rows.map((r) => r.id);
  }
}
