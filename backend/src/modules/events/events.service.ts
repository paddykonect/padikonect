import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Event,
  Prisma,
  RsvpStatus,
  Venue,
  VenueApproval,
} from '@prisma/client';
import { CursorPage } from '../../common/dto/cursor-pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoRepository } from '../../database/geo/geo.repository';
import { PrismaService } from '../../database/prisma.service';
import { GoogleMapsService } from '../../integrations/google-maps/google-maps.service';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// Assumptions flagged for product sign-off (see plan §Open questions style):
// "Tonight" = starts within the next 12h; "walking distance" = 2km;
// "Under ₦2k" = free or ≤ ₦2,000 (200,000 kobo).
const TONIGHT_WINDOW_MS = 12 * 60 * 60 * 1000;
const WALKING_DISTANCE_METERS = 2000;
const UNDER_TWO_K_KOBO = 200_000;
const NEARBY_CANDIDATE_CAP = 200;
const GOING: RsvpStatus[] = ['APPROVED', 'ATTENDED'];
const ATTENDEE_PREVIEW_SIZE = 3;

// Lagos has no DST, so "today" ends at the next 23:59:59 WAT (UTC+1).
const LAGOS_UTC_OFFSET_MS = 60 * 60 * 1000;
function endOfLagosDay(now: Date): Date {
  const lagos = new Date(now.getTime() + LAGOS_UTC_OFFSET_MS);
  lagos.setUTCHours(23, 59, 59, 999);
  return new Date(lagos.getTime() - LAGOS_UTC_OFFSET_MS);
}

type EventWithHost = Event & {
  host: {
    id: string;
    profile: { displayName: string | null; photoUrl: string | null } | null;
  };
  venue: Pick<
    Venue,
    'id' | 'name' | 'category' | 'addressText' | 'phone' | 'coverImageUrl'
  > | null;
  _count: { rsvps: number };
};

// Hangouts waiting on (or turned down by) their venue are only visible to
// the host until the venue confirms.
const LIVE_VENUE_APPROVAL: VenueApproval[] = ['NOT_REQUIRED', 'CONFIRMED'];

export interface EventListItemView {
  id: string;
  title: string;
  coverImageUrl: string | null;
  addressText: string;
  latitude: number;
  longitude: number;
  startAt: Date;
  endAt: Date | null;
  capacity: number;
  attendeeCount: number;
  priceKobo: number | null;
  drinkCategory: Event['drinkCategory'];
  tags: string[];
  status: Event['status'];
  isEnded: boolean;
  host: { id: string; displayName: string | null; photoUrl: string | null };
  /** The viewer's own RSVP, if any (drives Going / Requested / Join). */
  myRsvpStatus: RsvpStatus | null;
  /** How many of the viewer's padis are going. */
  padiCount: number;
  /** Whether the viewer has saved this hangout (the card's heart). */
  isFavorite: boolean;
}

type ViewerFields = Pick<
  EventListItemView,
  'myRsvpStatus' | 'padiCount' | 'isFavorite'
>;
const NO_VIEWER: ViewerFields = {
  myRsvpStatus: null,
  padiCount: 0,
  isFavorite: false,
};

export type EventDetailView = EventListItemView & {
  description: string | null;
  privacy: Event['privacy'];
  cancelReason: string | null;
  isHost: boolean;
  /** First few attendees, for the avatar stack. */
  attendeePreview: Array<{
    id: string;
    displayName: string | null;
    photoUrl: string | null;
  }>;
  /** Join requests waiting on the host; always 0 for non-hosts. */
  pendingRequestCount: number;
  venue: EventWithHost['venue'];
  venueApproval: VenueApproval;
  venueRequestedAt: Date | null;
  venueNote: string | null;
};

function isEnded(event: Pick<Event, 'startAt' | 'endAt'>): boolean {
  return (event.endAt ?? event.startAt) < new Date();
}

function toListItem(
  event: EventWithHost,
  viewer: ViewerFields = NO_VIEWER,
): EventListItemView {
  return {
    id: event.id,
    title: event.title,
    coverImageUrl: event.coverImageUrl,
    addressText: event.addressText,
    latitude: event.latitude,
    longitude: event.longitude,
    startAt: event.startAt,
    endAt: event.endAt,
    capacity: event.capacity,
    attendeeCount: event._count.rsvps,
    priceKobo: event.priceKobo,
    drinkCategory: event.drinkCategory,
    tags: event.tags,
    status: event.status,
    isEnded: isEnded(event),
    host: {
      id: event.host.id,
      displayName: event.host.profile?.displayName ?? null,
      photoUrl: event.host.profile?.photoUrl ?? null,
    },
    ...viewer,
  };
}

function toDetailView(
  event: EventWithHost,
  extra?: Partial<
    Pick<
      EventDetailView,
      | 'myRsvpStatus'
      | 'padiCount'
      | 'isHost'
      | 'attendeePreview'
      | 'pendingRequestCount'
    >
  >,
): EventDetailView {
  return {
    ...toListItem(event),
    description: event.description,
    privacy: event.privacy,
    cancelReason: event.cancelReason,
    isHost: false,
    attendeePreview: [],
    pendingRequestCount: 0,
    venue: event.venue,
    venueApproval: event.venueApproval,
    venueRequestedAt: event.venueRequestedAt,
    venueNote: event.venueNote,
    ...extra,
  };
}

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

const attendeeInclude = {
  host: { select: { id: true, profile: true } },
  venue: {
    select: {
      id: true,
      name: true,
      category: true,
      addressText: true,
      phone: true,
      coverImageUrl: true,
    },
  },
  _count: {
    select: {
      rsvps: { where: { status: { in: GOING } } },
    },
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoRepository,
    private readonly googleMaps: GoogleMapsService,
    private readonly notifications: NotificationsService,
    private readonly blocks: BlocksService,
  ) {}

  private async resolveLocation(
    addressText: string,
    latitude?: number,
    longitude?: number,
  ): Promise<{ latitude: number; longitude: number }> {
    if (latitude !== undefined && longitude !== undefined) {
      return { latitude, longitude };
    }
    return this.googleMaps.geocodeAddress(addressText);
  }

  private async findVenue(venueId: string): Promise<Venue> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
    });
    if (!venue) {
      throw new AppException(
        'VENUE_NOT_FOUND',
        'Venue not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return venue;
  }

  private validateTimes(startAt: Date, endAt: Date | undefined): void {
    if (startAt.getTime() <= Date.now()) {
      throw new AppException(
        'EVENT_START_IN_PAST',
        'The start time must be in the future.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (endAt && endAt.getTime() <= startAt.getTime()) {
      throw new AppException(
        'EVENT_END_BEFORE_START',
        'The end time must be after the start time.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async create(hostId: string, dto: CreateEventDto): Promise<EventDetailView> {
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    this.validateTimes(startAt, endAt);

    const venue = dto.venueId ? await this.findVenue(dto.venueId) : null;
    const { latitude, longitude } = venue
      ? venue
      : await this.resolveLocation(
          dto.addressText,
          dto.latitude,
          dto.longitude,
        );

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          hostId,
          title: dto.title,
          description: dto.description,
          addressText: venue
            ? `${venue.name}, ${venue.addressText}`
            : dto.addressText,
          venueId: venue?.id,
          venueApproval: venue ? 'PENDING' : 'NOT_REQUIRED',
          latitude,
          longitude,
          startAt,
          endAt,
          capacity: dto.capacity,
          priceKobo: dto.priceKobo,
          coverImageUrl: dto.coverImageUrl,
          drinkCategory: dto.drinkCategory,
          tags: dto.tags,
          privacy: dto.privacy,
        },
        include: attendeeInclude,
      });
      await this.geo.syncEventLocation(tx, created.id, latitude, longitude);

      const conversation = await tx.conversation.create({
        data: { type: 'EVENT', eventId: created.id },
      });
      await tx.conversationParticipant.create({
        data: { conversationId: conversation.id, userId: hostId },
      });

      return created;
    });

    return toDetailView(event);
  }

  /** Hangouts you host or were approved for, most recent first (Profile "Your hangouts"). */
  async listMine(userId: string): Promise<EventListItemView[]> {
    const events = await this.prisma.event.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [
          { hostId: userId },
          {
            rsvps: {
              some: { userId, status: { in: ['APPROVED', 'ATTENDED'] } },
            },
          },
        ],
      },
      orderBy: [{ startAt: 'desc' }, { id: 'asc' }],
      take: 20,
      include: attendeeInclude,
    });
    const viewer = await this.viewerFields(
      events.map((e) => e.id),
      userId,
    );
    return events.map((e) => toListItem(e, viewer.get(e.id)));
  }

  async getById(
    id: string,
    viewerId?: string,
    // Admins review venue requests, so they can open hangouts still pending.
    viewerIsAdmin = false,
  ): Promise<EventDetailView> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: attendeeInclude,
    });
    const hiddenFromViewer =
      event &&
      event.hostId !== viewerId &&
      !viewerIsAdmin &&
      (event.venueApproval === 'PENDING' || event.venueApproval === 'REJECTED');
    if (
      !event ||
      hiddenFromViewer ||
      (viewerId &&
        event.hostId !== viewerId &&
        (await this.blocks.isBlockedEitherWay(viewerId, event.hostId)))
    ) {
      throw new AppException(
        'EVENT_NOT_FOUND',
        'Hangout not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!viewerId) return toDetailView(event);

    const isHost = event.hostId === viewerId;
    const [viewer, preview, pendingRequestCount] = await Promise.all([
      this.viewerFields([id], viewerId),
      this.prisma.rsvp.findMany({
        where: { eventId: id, status: { in: GOING } },
        include: { user: { select: { id: true, profile: true } } },
        orderBy: { respondedAt: 'asc' },
        take: ATTENDEE_PREVIEW_SIZE,
      }),
      isHost
        ? this.prisma.rsvp.count({
            where: { eventId: id, status: 'REQUESTED' },
          })
        : Promise.resolve(0),
    ]);
    return toDetailView(event, {
      ...viewer.get(id),
      isHost,
      pendingRequestCount,
      attendeePreview: preview.map((r) => ({
        id: r.user.id,
        displayName: r.user.profile?.displayName ?? null,
        photoUrl: r.user.profile?.photoUrl ?? null,
      })),
    });
  }

  /** The viewer's RSVP status and padis-going count for each event. */
  private async viewerFields(
    eventIds: string[],
    viewerId: string,
  ): Promise<Map<string, ViewerFields>> {
    const result = new Map<string, ViewerFields>(
      eventIds.map((eid) => [eid, { ...NO_VIEWER }]),
    );
    if (eventIds.length === 0) return result;

    const [mine, padis, favorites] = await Promise.all([
      this.prisma.rsvp.findMany({
        where: { userId: viewerId, eventId: { in: eventIds } },
        select: { eventId: true, status: true },
      }),
      this.prisma.padiConnection.findMany({
        where: { userId: viewerId },
        select: { padiId: true },
      }),
      this.prisma.eventFavorite.findMany({
        where: { userId: viewerId, eventId: { in: eventIds } },
        select: { eventId: true },
      }),
    ]);
    for (const r of mine) {
      // A cancelled RSVP means the viewer can join again.
      if (r.status !== 'CANCELLED')
        result.get(r.eventId)!.myRsvpStatus = r.status;
    }
    for (const f of favorites) result.get(f.eventId)!.isFavorite = true;
    if (padis.length > 0) {
      const going = await this.prisma.rsvp.groupBy({
        by: ['eventId'],
        where: {
          eventId: { in: eventIds },
          userId: { in: padis.map((p) => p.padiId) },
          status: { in: GOING },
        },
        _count: { _all: true },
      });
      for (const g of going) result.get(g.eventId)!.padiCount = g._count._all;
    }
    return result;
  }

  // Idempotent: favouriting twice (or removing a non-favourite) is a no-op.
  async addFavorite(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      throw new AppException(
        'EVENT_NOT_FOUND',
        'Hangout not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.eventFavorite.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    });
  }

  async removeFavorite(userId: string, eventId: string): Promise<void> {
    await this.prisma.eventFavorite.deleteMany({ where: { userId, eventId } });
  }

  /** The user's saved hangouts, for the Home "Favorites" row. */
  async listFavorites(userId: string): Promise<EventListItemView[]> {
    const rows = await this.prisma.eventFavorite.findMany({
      where: { userId, event: { status: { not: 'CANCELLED' } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { event: { include: attendeeInclude } },
    });
    const events = rows.map((r) => r.event);
    const viewer = await this.viewerFields(
      events.map((e) => e.id),
      userId,
    );
    return events.map((e) => toListItem(e, viewer.get(e.id)));
  }

  async list(
    query: ListEventsQueryDto,
    viewerId?: string,
  ): Promise<CursorPage<EventListItemView>> {
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;

    const hidden = viewerId ? await this.blocks.hiddenUserIds(viewerId) : [];
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      privacy: 'PUBLIC',
      venueApproval: { in: LIVE_VENUE_APPROVAL },
      ...(query.venueId && { venueId: query.venueId }),
      ...(hidden.length && { hostId: { notIn: hidden } }),
    };

    // Tonight and Today both narrow the window; the earlier cut-off wins.
    const now = new Date();
    const cutoffs = [
      ...(query.tonight ? [now.getTime() + TONIGHT_WINDOW_MS] : []),
      ...(query.today ? [endOfLagosDay(now).getTime()] : []),
    ];
    where.startAt = {
      gte: now,
      ...(cutoffs.length && { lte: new Date(Math.min(...cutoffs)) }),
    };

    if (query.nonAlcoholic) {
      where.drinkCategory = { in: ['NON_ALCOHOLIC', 'BOTH'] };
    }

    if (query.tags?.length) {
      where.tags = { hasSome: query.tags };
    }

    const and: Prisma.EventWhereInput[] = [];
    if (query.underTwoK) {
      and.push({
        OR: [{ priceKobo: null }, { priceKobo: { lte: UNDER_TWO_K_KOBO } }],
      });
    }
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { addressText: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (and.length) where.AND = and;

    let nearbyIds: string[] | undefined;
    if (query.walkingDistance) {
      if (query.lat === undefined || query.lng === undefined) {
        throw new AppException(
          'LOCATION_REQUIRED',
          'lat and lng are required for the walking-distance filter.',
          HttpStatus.BAD_REQUEST,
        );
      }
      nearbyIds = await this.geo.findNearbyPublishedEventIds(
        query.lat,
        query.lng,
        WALKING_DISTANCE_METERS,
        NEARBY_CANDIDATE_CAP,
      );
      if (nearbyIds.length === 0) {
        return { items: [], nextCursor: null };
      }
    }

    const events = await this.prisma.event.findMany({
      where: { ...where, ...(nearbyIds && { id: { in: nearbyIds } }) },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
      include: attendeeInclude,
    });

    const hasMore = events.length > query.limit;
    const page = hasMore ? events.slice(0, query.limit) : events;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1].id) : null;

    const viewer = viewerId
      ? await this.viewerFields(
          page.map((e) => e.id),
          viewerId,
        )
      : undefined;
    return {
      items: page.map((e) => toListItem(e, viewer?.get(e.id))),
      nextCursor,
    };
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDetailView> {
    const existing = await this.prisma.event.findUniqueOrThrow({
      where: { id },
    });

    let latitude = existing.latitude;
    let longitude = existing.longitude;
    let locationChanged = false;
    const venue =
      dto.venueId && dto.venueId !== existing.venueId
        ? await this.findVenue(dto.venueId)
        : null;
    if (venue) {
      latitude = venue.latitude;
      longitude = venue.longitude;
      dto.addressText = `${venue.name}, ${venue.addressText}`;
      locationChanged = true;
    } else if (dto.latitude !== undefined && dto.longitude !== undefined) {
      latitude = dto.latitude;
      longitude = dto.longitude;
      locationChanged = true;
    } else if (
      dto.addressText !== undefined &&
      dto.addressText !== existing.addressText
    ) {
      const geocoded = await this.googleMaps.geocodeAddress(dto.addressText);
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      locationChanged = true;
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt =
      dto.endAt !== undefined
        ? dto.endAt
          ? new Date(dto.endAt)
          : undefined
        : (existing.endAt ?? undefined);
    const timeChanged = dto.startAt !== undefined || dto.endAt !== undefined;
    if (timeChanged) this.validateTimes(startAt, endAt);

    // A new venue, or a "Modify request" after the venue said no, goes back
    // to the venue for confirmation.
    const resubmit = venue !== null || existing.venueApproval === 'REJECTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      const ev = await tx.event.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.addressText !== undefined && {
            addressText: dto.addressText,
          }),
          latitude,
          longitude,
          startAt,
          endAt,
          ...(dto.capacity !== undefined && { capacity: dto.capacity }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.priceKobo !== undefined && { priceKobo: dto.priceKobo }),
          ...(dto.coverImageUrl !== undefined && {
            coverImageUrl: dto.coverImageUrl,
          }),
          ...(dto.drinkCategory !== undefined && {
            drinkCategory: dto.drinkCategory,
          }),
          ...(venue && { venueId: venue.id }),
          ...(resubmit &&
            (venue || existing.venueId) && {
              venueApproval: 'PENDING',
              venueRequestedAt: null,
              venueRespondedAt: null,
              venueNote: null,
            }),
        },
        include: attendeeInclude,
      });
      if (locationChanged)
        await this.geo.syncEventLocation(tx, id, latitude, longitude);
      return ev;
    });

    if (timeChanged || locationChanged) {
      const attendees = await this.prisma.rsvp.findMany({
        where: { eventId: id, status: { in: ['APPROVED', 'ATTENDED'] } },
        select: { userId: true },
      });
      await this.notifications.notifyMany(
        attendees.map((a) => a.userId),
        'EVENT_UPDATED',
        `"${updated.title}" details changed`,
        'The time or location for this hangout has changed. Check the hangout for details.',
        { eventId: id },
      );
    }

    return toDetailView(updated);
  }

  async cancel(id: string, dto: CancelEventDto): Promise<EventDetailView> {
    const existing = await this.prisma.event.findUniqueOrThrow({
      where: { id },
    });
    if (existing.status === 'CANCELLED') {
      throw new AppException(
        'EVENT_ALREADY_CANCELLED',
        'This hangout is already cancelled.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
      include: attendeeInclude,
    });

    const affected = await this.prisma.rsvp.findMany({
      where: {
        eventId: id,
        status: { in: ['APPROVED', 'ATTENDED', 'REQUESTED', 'WAITLISTED'] },
      },
      select: { userId: true },
    });
    await this.notifications.notifyMany(
      affected.map((a) => a.userId),
      'EVENT_CANCELLED',
      `"${updated.title}" was cancelled`,
      dto.reason ?? 'The host cancelled this hangout.',
      { eventId: id },
    );

    return toDetailView(updated);
  }

  async getAttendees(
    eventId: string,
  ): Promise<
    Array<{ id: string; displayName: string | null; photoUrl: string | null }>
  > {
    const rows = await this.prisma.rsvp.findMany({
      where: { eventId, status: { in: ['APPROVED', 'ATTENDED'] } },
      include: { user: { select: { id: true, profile: true } } },
      orderBy: { respondedAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.user.id,
      displayName: r.user.profile?.displayName ?? null,
      photoUrl: r.user.profile?.photoUrl ?? null,
    }));
  }
}
