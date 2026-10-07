import { randomInt } from 'node:crypto';
import { BlocksService } from '../blocks/blocks.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Rsvp, RsvpStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { countMutualHangouts } from '../events/mutual-hangouts';
import { NotificationsService } from '../notifications/notifications.service';

// No 0/O/1/I so the code reads cleanly off a screen ("PADI-7X3K9Q").
const PASS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newPassCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++)
    code += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)];
  return `PADI-${code}`;
}

interface LockedEvent {
  id: string;
  hostId: string;
  title: string;
  capacity: number;
  status: string;
  startAt: Date;
  endAt: Date | null;
  joinPolicy: string;
  privacy: string;
  venueApproval: string;
}

export interface PendingRsvpView {
  rsvpId: string;
  status: RsvpStatus;
  waitlistPosition: number | null;
  message: string | null;
  createdAt: Date;
  user: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface RsvpDetailView extends PendingRsvpView {
  user: PendingRsvpView['user'] & {
    state: string | null;
    memberSince: Date;
    mutualHangouts: number;
  };
}

export interface EntryPassView {
  passCode: string;
  status: RsvpStatus;
  checkedInAt: Date | null;
  decisionNote: string | null;
}

export interface CheckInView {
  alreadyCheckedIn: boolean;
  checkedInAt: Date;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly notifications: NotificationsService,
  ) {}

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, profile: { select: { displayName: true } } },
    });
    return user?.profile?.displayName ?? user?.fullName ?? 'A padi';
  }

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
      SELECT "id", "hostId", "title", "capacity", "status", "startAt", "endAt", "joinPolicy",
             "privacy", "venueApproval"
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

  async join(eventId: string, userId: string, message?: string): Promise<Rsvp> {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      // A host who blocked you (or whom you blocked) — the hangout is "not found".
      if (
        !event ||
        (await this.blocks.isBlockedEitherWay(userId, event.hostId))
      ) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      // Still waiting on the venue (or turned down): not open to guests yet.
      if (
        event.venueApproval === 'PENDING' ||
        event.venueApproval === 'REJECTED'
      ) {
        throw new AppException(
          'EVENT_NOT_FOUND',
          'Hangout not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (event.privacy === 'INVITE_ONLY') {
        const invite = await tx.eventInvite.findUnique({
          where: { eventId_userId: { eventId, userId } },
        });
        if (!invite) {
          throw new AppException(
            'INVITE_REQUIRED',
            'This hangout is invite-only.',
            HttpStatus.FORBIDDEN,
          );
        }
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

      const note = message?.trim() || null;
      const rsvp = await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          status,
          waitlistPosition,
          respondedAt,
          message: note,
        },
        update: {
          status,
          waitlistPosition,
          respondedAt,
          message: note,
          decisionNote: null,
        },
      });

      if (status === 'APPROVED') {
        await this.addToConversation(tx, eventId, userId);
      }

      return { rsvp, event };
    });

    if (result.rsvp.status === 'REQUESTED') {
      const name = await this.displayName(userId);
      await this.notifications.notify(
        result.event.hostId,
        'RSVP_REQUESTED',
        `${name} wants to join`,
        `New request for "${result.event.title}".`,
        { eventId, userId },
      );
    }
    return result.rsvp;
  }

  async approve(
    eventId: string,
    targetUserId: string,
    note?: string,
  ): Promise<Rsvp> {
    const result = await this.prisma.$transaction(async (tx) => {
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
        data: {
          status: newStatus,
          waitlistPosition,
          respondedAt: new Date(),
          decisionNote: note?.trim() || null,
        },
      });

      if (newStatus === 'APPROVED') {
        await this.addToConversation(tx, eventId, targetUserId);
      }
      return { updated, event };
    });

    const { updated, event } = result;
    const approved = updated.status === 'APPROVED';
    await this.notifications.notify(
      targetUserId,
      'RSVP_APPROVED',
      approved
        ? `You're in for "${event.title}"!`
        : `You're on the waitlist for "${event.title}"`,
      updated.decisionNote ??
        (approved
          ? 'Your entry pass is ready in the hangout.'
          : "It filled up, so you're on the waitlist."),
      { eventId },
    );
    return updated;
  }

  async decline(
    eventId: string,
    targetUserId: string,
    note?: string,
  ): Promise<Rsvp> {
    const result = await this.prisma.$transaction(async (tx) => {
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
      const updated = await tx.rsvp.update({
        where: { id: rsvp.id },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
          decisionNote: note?.trim() || null,
        },
      });
      return { updated, event };
    });

    await this.notifications.notify(
      targetUserId,
      'RSVP_DECLINED',
      `Your request for "${result.event.title}" was declined`,
      result.updated.decisionNote ?? 'The host could not fit you in this time.',
      { eventId },
    );
    return result.updated;
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
      message: r.message,
      createdAt: r.createdAt,
      user: {
        id: r.user.id,
        displayName: r.user.profile?.displayName ?? null,
        photoUrl: r.user.profile?.photoUrl ?? null,
      },
    }));
  }

  /** Host view of one request (Figma "Request detail"). */
  async getForHost(
    eventId: string,
    targetUserId: string,
    hostId: string,
  ): Promise<RsvpDetailView> {
    const r = await this.prisma.rsvp.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
      include: {
        user: {
          select: { id: true, fullName: true, createdAt: true, profile: true },
        },
      },
    });
    if (!r) {
      throw new AppException(
        'RSVP_NOT_FOUND',
        'No request found for this user.',
        HttpStatus.NOT_FOUND,
      );
    }
    const mutual = await countMutualHangouts(this.prisma, hostId, [
      targetUserId,
    ]);
    return {
      rsvpId: r.id,
      status: r.status,
      waitlistPosition: r.waitlistPosition,
      message: r.message,
      createdAt: r.createdAt,
      user: {
        id: r.user.id,
        displayName: r.user.profile?.displayName ?? r.user.fullName,
        photoUrl: r.user.profile?.photoUrl ?? null,
        state: r.user.profile?.state ?? null,
        memberSince: r.user.createdAt,
        mutualHangouts: mutual.get(targetUserId) ?? 0,
      },
    };
  }

  /** The approved guest's entry pass; the code is minted on first view. */
  async myPass(eventId: string, userId: string): Promise<EntryPassView> {
    const rsvp = await this.prisma.rsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (
      !rsvp ||
      !(['APPROVED', 'ATTENDED'] as RsvpStatus[]).includes(rsvp.status)
    ) {
      throw new AppException(
        'PASS_NOT_AVAILABLE',
        'Your entry pass shows up once the host accepts your request.',
        HttpStatus.NOT_FOUND,
      );
    }
    let passCode = rsvp.passCode;
    for (let attempt = 0; !passCode && attempt < 5; attempt++) {
      try {
        passCode = (
          await this.prisma.rsvp.update({
            where: { id: rsvp.id },
            data: { passCode: newPassCode() },
          })
        ).passCode;
      } catch (err) {
        // Unique clash on the code: try another one.
        if (!(
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ))
          throw err;
      }
    }
    return {
      passCode: passCode!,
      status: rsvp.status,
      checkedInAt: rsvp.checkedInAt,
      decisionNote: rsvp.decisionNote,
    };
  }

  /** Host scans a guest's pass at the door (Figma "Scan padi"). */
  async checkIn(eventId: string, code: string): Promise<CheckInView> {
    const rsvp = await this.prisma.rsvp.findFirst({
      where: { eventId, passCode: code.trim().toUpperCase() },
      include: {
        user: { select: { id: true, fullName: true, profile: true } },
      },
    });
    if (
      !rsvp ||
      !(['APPROVED', 'ATTENDED'] as RsvpStatus[]).includes(rsvp.status)
    ) {
      throw new AppException(
        'PASS_INVALID',
        "This pass isn't valid for this hangout.",
        HttpStatus.NOT_FOUND,
      );
    }
    const alreadyCheckedIn = rsvp.checkedInAt !== null;
    const checkedInAt = rsvp.checkedInAt ?? new Date();
    if (!alreadyCheckedIn) {
      await this.prisma.rsvp.update({
        where: { id: rsvp.id },
        data: { status: 'ATTENDED', checkedInAt },
      });
    }
    return {
      alreadyCheckedIn,
      checkedInAt,
      user: {
        id: rsvp.user.id,
        displayName: rsvp.user.profile?.displayName ?? rsvp.user.fullName,
        photoUrl: rsvp.user.profile?.photoUrl ?? null,
      },
    };
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
