import { Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PadiUserView, padiUserSelect, toPadiUser } from '../padis/padi-user';
import { ratingSummary } from '../padis/padi-rating.util';

// ~100m precision: enough to see who's around, not which building they're in.
const COORD_DECIMALS = 3;
// Locations older than this are treated as "not around".
export const LOCATION_FRESH_MS = 2 * 60 * 60 * 1000;

export interface RadarPadiView {
  user: PadiUserView;
  latitude: number;
  longitude: number;
  updatedAt: Date;
  ratingAvg: number | null;
  ratingCount: number;
  // Whether the viewer has added this padi back (drives "Add padi" vs "Padis").
  isPadi: boolean;
  // Whether the viewer has hidden themselves from this padi (eye toggle state).
  hiddenFromThem: boolean;
}

function round(value: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(value * f) / f;
}

@Injectable()
export class RadarService {
  constructor(private readonly prisma: PrismaService) {}

  async status(
    userId: string,
  ): Promise<{ sharing: boolean; updatedAt: Date | null }> {
    const row = await this.prisma.liveLocation.findUnique({
      where: { userId },
    });
    return { sharing: !!row, updatedAt: row?.updatedAt ?? null };
  }

  /** Starts sharing, or refreshes your shared location. */
  async share(userId: string, latitude: number, longitude: number) {
    const data = { latitude: round(latitude), longitude: round(longitude) };
    const row = await this.prisma.liveLocation.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { sharing: true, updatedAt: row.updatedAt };
  }

  /** Stops sharing and deletes the stored location. */
  async stop(userId: string): Promise<void> {
    await this.prisma.liveLocation.deleteMany({ where: { userId } });
  }

  /** Hide yourself from this padi (eye toggle) — radar + profile, silently. */
  async hide(userId: string, padiId: string): Promise<void> {
    if (userId === padiId) return;
    await this.prisma.radarHide.upsert({
      where: { userId_hiddenFromId: { userId, hiddenFromId: padiId } },
      create: { userId, hiddenFromId: padiId },
      update: {},
    });
  }

  /** Become visible to this padi again. */
  async unhide(userId: string, padiId: string): Promise<void> {
    await this.prisma.radarHide.deleteMany({
      where: { userId, hiddenFromId: padiId },
    });
  }

  /**
   * Fresh locations of people who've added *you* as a padi — sharing is a
   * choice the sharer made about the people they trust. Sharers who've hidden
   * from you (eye toggle) are excluded.
   */
  async padisNearby(userId: string): Promise<RadarPadiView[]> {
    const rows = await this.prisma.liveLocation.findMany({
      where: {
        updatedAt: { gt: new Date(Date.now() - LOCATION_FRESH_MS) },
        userId: { not: userId },
        user: {
          status: AccountStatus.ACTIVE,
          padiConnections: { some: { padiId: userId } },
          radarHidesMade: { none: { hiddenFromId: userId } },
        },
      },
      include: { user: { select: padiUserSelect } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const ids = rows.map((r) => r.userId);
    const [summaries, iAdded, iHid] = await Promise.all([
      ratingSummary(this.prisma, ids),
      this.prisma.padiConnection.findMany({
        where: { userId, padiId: { in: ids } },
        select: { padiId: true },
      }),
      this.prisma.radarHide.findMany({
        where: { userId, hiddenFromId: { in: ids } },
        select: { hiddenFromId: true },
      }),
    ]);
    const added = new Set(iAdded.map((c) => c.padiId));
    const hidden = new Set(iHid.map((h) => h.hiddenFromId));

    return rows.map((r) => ({
      user: toPadiUser(r.user),
      latitude: r.latitude,
      longitude: r.longitude,
      updatedAt: r.updatedAt,
      ratingAvg: summaries.get(r.userId)?.ratingAvg ?? null,
      ratingCount: summaries.get(r.userId)?.ratingCount ?? 0,
      isPadi: added.has(r.userId),
      hiddenFromThem: hidden.has(r.userId),
    }));
  }
}
