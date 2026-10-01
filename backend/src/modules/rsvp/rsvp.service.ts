import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Rsvp, RsvpStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';

interface LockedEvent {
  id: string;
  hostId: string;
  title: string;
  capacity: number;
  status: string;
  startAt: Date;
  endAt: Date | null;
  joinPolicy: string;
}

export interface PendingRsvpView {
  rsvpId: string;
  status: RsvpStatus;
  waitlistPosition: number | null;
  createdAt: Date;
  user: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface MyRsvpView {
  rsvpStatus: RsvpStatus;
  event: {
    id: string;
    title: string;
    coverImageUrl: string | null;
    startAt: Date;
    addressText: string;
  };
}

@Injectable()
export class RsvpService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Locks the Event row for the duration of the enclosing transaction —
   * every mutating RSVP operation (join/approve/decline/cancel) starts here,
   * which is what actually serializes concurrent joins against the same
   * event and guarantees capacity is never exceeded. See plan §RSVP/capacity
   * concurrency.
   */
  private async lockEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<LockedEvent | undefined> {
    const rows = await tx.$queryRaw<LockedEvent[]>`
      SELECT "id", "hostId", "title", "capacity", "status", "startAt", "endAt", "joinPolicy"
      FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
    `;
    return rows[0];
  }

  private async addToConversation(
    tx: Prisma.TransactionClient,
    eventId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await tx.conversation.findUnique({
      where: { eventId },
    });
    if (!conversation) return;
    await tx.conversationParticipant.upsert({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId },
      },
      create: { conversationId: conversation.id, userId },
      update: {},
    });
  }

  private async nextWaitlistPosition(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<number> {
    const agg = await tx.rsvp.aggregate({
      where: { eventId, status: 'WAITLISTED' },
      _max: { waitlistPosition: true },
    });
    return (agg._max.waitlistPosition ?? 0) + 1;
  }

  async join(eventId: string, userId: string): Promise<Rsvp> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (!event) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (event.status !== 'PUBLISHED') {
        throw new AppException(
          'EVENT_CANCELLED',
          'This hangout has been cancelled.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if ((event.endAt ?? event.startAt) < new Date()) {
        throw new AppException(
          'EVENT_ENDED',
          'This hangout has already ended.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (event.hostId === userId) {
        throw new AppException(
          'CANNOT_JOIN_OWN_EVENT',
          "You're hosting this hangout.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const approvedCount = await tx.rsvp.count({
        where: { eventId, status: { in: ['APPROVED', 'ATTENDED'] } },
      });

      let status: RsvpStatus;
      if (event.joinPolicy === 'APPROVAL') {
        status = 'REQUESTED';
      } else if (approvedCount < event.capacity) {
        status = 'APPROVED';
      } else {
        status = 'WAITLISTED';
      }

      const waitlistPosition =
        status === 'WAITLISTED'
          ? await this.nextWaitlistPosition(tx, eventId)
          : null;
      const respondedAt = status === 'REQUESTED' ? null : new Date();

      const rsvp = await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status, waitlistPosition, respondedAt },
        update: { status, waitlistPosition, respondedAt },
      });

      if (status === 'APPROVED') {
        await this.addToConversation(tx, eventId, userId);
      }

      return rsvp;
    });
  }

  async approve(eventId: string, targetUserId: string): Promise<Rsvp> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (!event) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const rsvp = await tx.rsvp.findUnique({
        where: { eventId_userId: { eventId, userId: targetUserId } },
      });
      if (
        !rsvp ||
        !(['REQUESTED', 'WAITLISTED'] as RsvpStatus[]).includes(rsvp.status)
      ) {
        throw new AppException(
          'RSVP_NOT_FOUND',
          'No pending request found for this user.',
          HttpStatus.NOT_FOUND,
        );
      }

      const approvedCount = await tx.rsvp.count({
        where: { eventId, status: { in: ['APPROVED', 'ATTENDED'] } },
      });
      // Capacity may have filled since the request was made — approval
      // becomes a waitlist assignment instead of silently exceeding capacity.
      const newStatus: RsvpStatus =
        approvedCount < event.capacity ? 'APPROVED' : 'WAITLISTED';
      const waitlistPosition =
        newStatus === 'WAITLISTED'
          ? (rsvp.waitlistPosition ??
            (await this.nextWaitlistPosition(tx, eventId)))
          : null;

      const updated = await tx.rsvp.update({
        where: { id: rsvp.id },
        data: { status: newStatus, waitlistPosition, respondedAt: new Date() },
      });

      if (newStatus === 'APPROVED') {
        await this.addToConversation(tx, eventId, targetUserId);
      }
      return updated;
    });
  }

  async decline(eventId: string, targetUserId: string): Promise<Rsvp> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (!event) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      const rsvp = await tx.rsvp.findUnique({
        where: { eventId_userId: { eventId, userId: targetUserId } },
      });
      if (!rsvp) {
        throw new AppException(
          'RSVP_NOT_FOUND',
          'No request found for this user.',
          HttpStatus.NOT_FOUND,
        );
      }
      return tx.rsvp.update({
        where: { id: rsvp.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
    });
  }

  async cancel(eventId: string, userId: string): Promise<Rsvp> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (!event) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      const rsvp = await tx.rsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!rsvp) {
        throw new AppException(
          'RSVP_NOT_FOUND',
          "You haven't joined this hangout.",
          HttpStatus.NOT_FOUND,
        );
      }

      const wasApproved = rsvp.status === 'APPROVED';
      const updated = await tx.rsvp.update({
        where: { id: rsvp.id },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      if (wasApproved) {
        const next = await tx.rsvp.findFirst({
          where: { eventId, status: 'WAITLISTED' },
          orderBy: { waitlistPosition: 'asc' },
        });
        if (next) {
          await tx.rsvp.update({
            where: { id: next.id },
            data: {
              status: 'APPROVED',
              waitlistPosition: null,
              respondedAt: new Date(),
            },
          });
          await this.addToConversation(tx, eventId, next.userId);
        }
      }

      return updated;
    });
  }

  async listPendingForHost(eventId: string): Promise<PendingRsvpView[]> {
    const rows = await this.prisma.rsvp.findMany({
      where: { eventId, status: { in: ['REQUESTED', 'WAITLISTED'] } },
      include: { user: { select: { id: true, profile: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      rsvpId: r.id,
      status: r.status,
      waitlistPosition: r.waitlistPosition,
      createdAt: r.createdAt,
      user: {
        id: r.user.id,
        displayName: r.user.profile?.displayName ?? null,
        photoUrl: r.user.profile?.photoUrl ?? null,
      },
    }));
  }

  async myRsvps(userId: string): Promise<MyRsvpView[]> {
    const rows = await this.prisma.rsvp.findMany({
      where: {
        userId,
        status: { in: ['REQUESTED', 'APPROVED', 'WAITLISTED', 'ATTENDED'] },
      },
      include: { event: true },
      orderBy: { event: { startAt: 'asc' } },
    });
    return rows.map((r) => ({
      rsvpStatus: r.status,
      event: {
        id: r.event.id,
        title: r.event.title,
        coverImageUrl: r.event.coverImageUrl,
        startAt: r.event.startAt,
        addressText: r.event.addressText,
      },
    }));
  }
}
