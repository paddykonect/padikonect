import { HttpStatus, Injectable } from '@nestjs/common';
import { EventStatus, Prisma, RsvpStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { EMPTY_RATING, ratingSummary } from './padi-rating.util';

const PARTICIPANT_RSVP = [RsvpStatus.APPROVED, RsvpStatus.ATTENDED];

export interface RatingContext {
  ratingAvg: number | null;
  ratingCount: number;
  canRate: boolean;
  rateableEventId: string | null;
  myRating: number | null;
}

@Injectable()
export class PadiRatingService {
  constructor(private readonly prisma: PrismaService) {}

  // An event both people took part in (host, or an approved/attended RSVP)
  // that has already started and wasn't cancelled — the unlock for rating.
  private sharedEventWhere(
    aId: string,
    bId: string,
    eventId?: string,
  ): Prisma.EventWhereInput {
    const participated = (id: string): Prisma.EventWhereInput => ({
      OR: [
        { hostId: id },
        { rsvps: { some: { userId: id, status: { in: PARTICIPANT_RSVP } } } },
      ],
    });
    return {
      ...(eventId ? { id: eventId } : {}),
      status: { not: EventStatus.CANCELLED },
      startAt: { lt: new Date() },
      AND: [participated(aId), participated(bId)],
    };
  }

  async rateableEventId(
    raterId: string,
    rateeId: string,
  ): Promise<string | null> {
    if (raterId === rateeId) return null;
    const event = await this.prisma.event.findFirst({
      where: this.sharedEventWhere(raterId, rateeId),
      orderBy: { startAt: 'desc' },
      select: { id: true },
    });
    return event?.id ?? null;
  }

  // Rating data for the Padi Profile: the ratee's aggregate plus whether the
  // viewer may rate them (and the stars they gave already, if any).
  async context(viewerId: string, rateeId: string): Promise<RatingContext> {
    const [summaries, rateableEventId] = await Promise.all([
      ratingSummary(this.prisma, [rateeId]),
      this.rateableEventId(viewerId, rateeId),
    ]);
    const summary = summaries.get(rateeId) ?? EMPTY_RATING;
    let myRating: number | null = null;
    if (rateableEventId) {
      const mine = await this.prisma.padiRating.findUnique({
        where: {
          raterId_rateeId_eventId: {
            raterId: viewerId,
            rateeId,
            eventId: rateableEventId,
          },
        },
        select: { stars: true },
      });
      myRating = mine?.stars ?? null;
    }
    return {
      ratingAvg: summary.ratingAvg,
      ratingCount: summary.ratingCount,
      canRate: !!rateableEventId,
      rateableEventId,
      myRating,
    };
  }

  async rate(
    raterId: string,
    rateeId: string,
    eventId: string,
    stars: number,
  ): Promise<RatingContext> {
    if (raterId === rateeId) {
      throw new AppException(
        'CANNOT_RATE_SELF',
        'You cannot rate yourself.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const event = await this.prisma.event.findFirst({
      where: this.sharedEventWhere(raterId, rateeId, eventId),
      select: { id: true },
    });
    if (!event) {
      throw new AppException(
        'RATING_NOT_ALLOWED',
        'You can only rate a padi you shared a hangout with.',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.prisma.padiRating.upsert({
      where: { raterId_rateeId_eventId: { raterId, rateeId, eventId } },
      create: { raterId, rateeId, eventId, stars },
      update: { stars },
    });
    return this.context(raterId, rateeId);
  }
}
