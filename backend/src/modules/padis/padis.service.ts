import { HttpStatus, Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { isHiddenFrom } from '../radar/radar-hide';
import { LOCATION_FRESH_MS } from '../radar/radar.service';
import { ratingSummary } from './padi-rating.util';
import { PadiRatingService } from './padi-rating.service';
import { PadiUserView, padiUserSelect, toPadiUser } from './padi-user';

// A padi in the "View the list" directory: all your padis (online or offline),
// with rating and — only while they're sharing a fresh location — coordinates
// so the client can show distance.
export interface PadiListItem {
  user: PadiUserView;
  ratingAvg: number | null;
  ratingCount: number;
  latitude: number | null;
  longitude: number | null;
}

export interface PadiProfileView {
  user: PadiUserView;
  bio: string | null;
  location: string | null;
  memberSince: Date;
  hostedCount: number;
  attendedCount: number;
  isPadi: boolean;
  isMe: boolean;
  mutualPadis: PadiUserView[];
  // Only visible once you've added them (same rule as the status feed).
  activeStatus: { id: string; text: string | null; createdAt: Date } | null;
  hostedHangouts: Array<{
    id: string;
    title: string;
    startAt: Date;
    addressText: string;
    goingCount: number;
  }>;
  // Peer rating: the ratee's average/count, plus whether the viewer can rate
  // them (shared a started hangout) and the stars the viewer gave already.
  ratingAvg: number | null;
  ratingCount: number;
  canRate: boolean;
  rateableEventId: string | null;
  myRating: number | null;
}

@Injectable()
export class PadisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly ratings: PadiRatingService,
  ) {}

  async list(userId: string): Promise<PadiUserView[]> {
    const rows = await this.prisma.padiConnection.findMany({
      where: { userId, padi: { status: AccountStatus.ACTIVE } },
      orderBy: { createdAt: 'desc' },
      include: { padi: { select: padiUserSelect } },
    });
    return rows.map((r) => toPadiUser(r.padi));
  }

  // All of the user's padis (online or offline) for the "View the list" screen,
  // enriched with rating + fresh coordinates. Padis who've hidden from the user
  // are excluded (same rule as radar/profile).
  async directory(userId: string): Promise<PadiListItem[]> {
    const rows = await this.prisma.padiConnection.findMany({
      where: {
        userId,
        padi: {
          status: AccountStatus.ACTIVE,
          radarHidesMade: { none: { hiddenFromId: userId } },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        padi: {
          select: {
            ...padiUserSelect,
            liveLocation: {
              select: { latitude: true, longitude: true, updatedAt: true },
            },
          },
        },
      },
    });
    const summaries = await ratingSummary(
      this.prisma,
      rows.map((r) => r.padiId),
    );
    const freshAfter = Date.now() - LOCATION_FRESH_MS;
    return rows.map((r) => {
      const loc = r.padi.liveLocation;
      const fresh = loc && loc.updatedAt.getTime() > freshAfter ? loc : null;
      const summary = summaries.get(r.padiId);
      return {
        user: toPadiUser(r.padi),
        ratingAvg: summary?.ratingAvg ?? null,
        ratingCount: summary?.ratingCount ?? 0,
        latitude: fresh?.latitude ?? null,
        longitude: fresh?.longitude ?? null,
      };
    });
  }

  // Idempotent — adding an existing padi is a no-op.
  async add(userId: string, padiId: string): Promise<void> {
    if (userId === padiId) {
      throw new AppException(
        'PADI_SELF',
        "You can't add yourself as a padi.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: padiId },
      select: { status: true },
    });
    if (!target || target.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'USER_NOT_FOUND',
        'That person could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.blocks.assertNotBlocked(userId, padiId);
    await this.prisma.padiConnection.upsert({
      where: { userId_padiId: { userId, padiId } },
      create: { userId, padiId },
      update: {},
    });
  }

  async remove(userId: string, padiId: string): Promise<void> {
    await this.prisma.padiConnection.deleteMany({ where: { userId, padiId } });
  }

  async padiIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.padiConnection.findMany({
      where: { userId },
      select: { padiId: true },
    });
    return rows.map((r) => r.padiId);
  }

  async profile(viewerId: string, userId: string): Promise<PadiProfileView> {
    if (viewerId !== userId) {
      await this.blocks.assertNotBlocked(viewerId, userId);
      // Someone who hid from you (radar eye toggle) reads as "not found".
      if (await isHiddenFrom(this.prisma, userId, viewerId)) {
        throw new AppException(
          'USER_NOT_FOUND',
          'That person could not be found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...padiUserSelect,
        status: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            photoUrl: true,
            wantsToBeInvitedFor: true,
            bio: true,
            state: true,
            country: true,
          },
        },
      },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'USER_NOT_FOUND',
        'That person could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const isMe = viewerId === userId;
    const now = new Date();
    const [myPadiIds, theirPadiIds, hostedCount, attendedCount, hosted] =
      await Promise.all([
        this.padiIds(viewerId),
        this.padiIds(userId),
        this.prisma.event.count({
          where: { hostId: userId, status: { not: 'CANCELLED' } },
        }),
        this.prisma.rsvp.count({
          where: {
            userId,
            status: { in: ['APPROVED', 'ATTENDED'] },
            event: { status: { not: 'CANCELLED' }, startAt: { lt: now } },
          },
        }),
        this.prisma.event.findMany({
          where: {
            hostId: userId,
            status: 'PUBLISHED',
            privacy: 'PUBLIC',
            startAt: { gte: now },
          },
          orderBy: { startAt: 'asc' },
          take: 5,
          include: {
            _count: {
              select: {
                rsvps: { where: { status: { in: ['APPROVED', 'ATTENDED'] } } },
              },
            },
          },
        }),
      ]);
    const isPadi = myPadiIds.includes(userId);
    const mutualIds = myPadiIds.filter((id) => theirPadiIds.includes(id));

    const [mutualUsers, status, rating] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: mutualIds }, status: AccountStatus.ACTIVE },
        select: padiUserSelect,
        take: 12,
      }),
      isPadi || isMe
        ? this.prisma.padiStatus.findFirst({
            where: { userId, expiresAt: { gt: now } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, text: true, createdAt: true },
          })
        : null,
      this.ratings.context(viewerId, userId),
    ]);

    return {
      user: toPadiUser(user),
      bio: user.profile?.bio ?? null,
      location:
        [user.profile?.state, user.profile?.country]
          .filter(Boolean)
          .join(', ') || null,
      memberSince: user.createdAt,
      hostedCount,
      attendedCount,
      isPadi,
      isMe,
      mutualPadis: mutualUsers.map(toPadiUser),
      activeStatus: status,
      hostedHangouts: hosted.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        addressText: e.addressText,
        goingCount: e._count.rsvps,
      })),
      ...rating,
    };
  }
}
