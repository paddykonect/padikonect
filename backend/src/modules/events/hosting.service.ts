import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VenueResponseDto } from './dto/venue-response.dto';
import { countMutualHangouts } from './mutual-hangouts';

export interface VenueRequestView {
  eventId: string;
  title: string;
  startAt: Date;
  capacity: number;
  venueApproval: string;
  venueRequestedAt: Date | null;
  venueRespondedAt: Date | null;
  venueNote: string | null;
  venue: {
    id: string;
    name: string;
    addressText: string;
    phone: string | null;
  };
  host: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface InviteCandidateView {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  state: string | null;
  mutualHangouts: number;
  invited: boolean;
  /** Already requested/joined — no point inviting again. */
  joined: boolean;
}

/**
 * Host-a-hangout extras on top of EventsService: the venue confirmation
 * round-trip and the "Invite padis" picker.
 */
@Injectable()
export class HostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: true },
    });
    if (!event) {
      throw new AppException(
        'EVENT_NOT_FOUND',
        'Hangout not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return event;
  }

  /**
   * "Send in-app message": records the request and alerts the venue's
   * reviewers. Venues have no accounts yet, so admins respond on their
   * behalf via respondForVenue (see plan note on venue accounts).
   */
  async requestVenueConfirmation(
    eventId: string,
  ): Promise<{ venueRequestedAt: Date }> {
    const event = await this.getEvent(eventId);
    if (!event.venue || event.venueApproval !== 'PENDING') {
      throw new AppException(
        'VENUE_CONFIRMATION_NOT_NEEDED',
        "This hangout doesn't need venue confirmation.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const venueRequestedAt = event.venueRequestedAt ?? new Date();
    if (!event.venueRequestedAt) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { venueRequestedAt },
      });
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', deletedAt: null },
        select: { id: true },
      });
      await this.notifications.notifyMany(
        admins.map((a) => a.id),
        'VENUE_REQUEST',
        `${event.venue.name}: new hangout request`,
        `"${event.title}" for ${event.capacity} padis needs the venue's confirmation.`,
        { eventId, venueId: event.venue.id },
      );
    }
    return { venueRequestedAt };
  }

  /** Admin queue: hangouts waiting on a venue first, then recent decisions. */
  async listVenueRequests(): Promise<VenueRequestView[]> {
    const events = await this.prisma.event.findMany({
      where: {
        venueId: { not: null },
        status: 'PUBLISHED',
        venueRequestedAt: { not: null },
        venueApproval: { in: ['PENDING', 'CONFIRMED', 'REJECTED'] },
      },
      include: {
        venue: true,
        host: { select: { id: true, fullName: true, profile: true } },
      },
      orderBy: { venueRequestedAt: 'desc' },
      take: 100,
    });
    const rank = (a: string) => (a === 'PENDING' ? 0 : 1);
    return events
      .filter((e) => e.venue)
      .sort((a, b) => rank(a.venueApproval) - rank(b.venueApproval))
      .map((e) => ({
        eventId: e.id,
        title: e.title,
        startAt: e.startAt,
        capacity: e.capacity,
        venueApproval: e.venueApproval,
        venueRequestedAt: e.venueRequestedAt,
        venueRespondedAt: e.venueRespondedAt,
        venueNote: e.venueNote,
        venue: {
          id: e.venue!.id,
          name: e.venue!.name,
          addressText: e.venue!.addressText,
          phone: e.venue!.phone,
        },
        host: {
          id: e.host.id,
          displayName: e.host.profile?.displayName ?? e.host.fullName,
          photoUrl: e.host.profile?.photoUrl ?? null,
        },
      }));
  }

  async respondForVenue(
    eventId: string,
    dto: VenueResponseDto,
  ): Promise<{ venueApproval: string }> {
    const event = await this.getEvent(eventId);
    if (!event.venue || event.venueApproval !== 'PENDING') {
      throw new AppException(
        'VENUE_NOT_PENDING',
        'This hangout is not waiting on a venue.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        venueApproval: dto.decision,
        venueRespondedAt: new Date(),
        venueNote: dto.note ?? null,
      },
    });
    const confirmed = dto.decision === 'CONFIRMED';
    await this.notifications.notify(
      event.hostId,
      confirmed ? 'VENUE_CONFIRMED' : 'VENUE_REJECTED',
      confirmed
        ? `${event.venue.name} confirmed your hangout!`
        : `${event.venue.name} couldn't host your hangout`,
      confirmed
        ? `"${event.title}" is now live for padis to see.`
        : (dto.note ?? 'The venue was unable to accommodate your request.'),
      { eventId },
    );
    return { venueApproval: dto.decision };
  }

  /** The host's padis, suggested ones (shared hangouts) first. */
  async inviteCandidates(
    eventId: string,
    hostId: string,
  ): Promise<InviteCandidateView[]> {
    const [padis, invites, rsvps] = await Promise.all([
      this.prisma.padiConnection.findMany({
        where: { userId: hostId },
        include: {
          padi: { select: { id: true, fullName: true, profile: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.eventInvite.findMany({
        where: { eventId },
        select: { userId: true },
      }),
      this.prisma.rsvp.findMany({
        where: {
          eventId,
          status: { in: ['REQUESTED', 'APPROVED', 'WAITLISTED', 'ATTENDED'] },
        },
        select: { userId: true },
      }),
    ]);
    const invited = new Set(invites.map((i) => i.userId));
    const joined = new Set(rsvps.map((r) => r.userId));
    const mutual = await countMutualHangouts(
      this.prisma,
      hostId,
      padis.map((p) => p.padiId),
    );
    return padis
      .map((p) => ({
        id: p.padi.id,
        displayName: p.padi.profile?.displayName ?? p.padi.fullName,
        photoUrl: p.padi.profile?.photoUrl ?? null,
        state: p.padi.profile?.state ?? null,
        // Subtract the hangout being planned right now (the host is part of it).
        mutualHangouts: Math.max(
          0,
          (mutual.get(p.padiId) ?? 0) - (joined.has(p.padiId) ? 1 : 0),
        ),
        invited: invited.has(p.padiId),
        joined: joined.has(p.padiId),
      }))
      .sort((a, b) => b.mutualHangouts - a.mutualHangouts);
  }

  async invite(
    eventId: string,
    hostId: string,
    userIds: string[],
  ): Promise<{ invited: number }> {
    const event = await this.getEvent(eventId);
    // Only the host's own padis can be invited from the picker.
    const padis = await this.prisma.padiConnection.findMany({
      where: { userId: hostId, padiId: { in: userIds } },
      select: { padiId: true },
    });
    const ids = padis.map((p) => p.padiId);
    const created = await this.prisma.eventInvite.createManyAndReturn({
      data: ids.map((userId) => ({ eventId, userId })),
      skipDuplicates: true,
      select: { userId: true },
    });
    const host = await this.prisma.profile.findUnique({
      where: { userId: hostId },
      select: { displayName: true },
    });
    await this.notifications.notifyMany(
      created.map((c) => c.userId),
      'EVENT_INVITE',
      `${host?.displayName ?? 'A padi'} invited you to "${event.title}"`,
      'Tap to see the hangout and request to join.',
      { eventId },
    );
    return { invited: created.length };
  }
}
