import { HttpStatus, Injectable } from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { CursorPage } from '../../common/dto/cursor-pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoRepository } from '../../database/geo/geo.repository';
import { PrismaService } from '../../database/prisma.service';
import { GoogleMapsService } from '../../integrations/google-maps/google-maps.service';
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

type EventWithHost = Event & {
  host: {
    id: string;
    profile: { displayName: string | null; photoUrl: string | null } | null;
  };
  _count: { rsvps: number };
};

export interface EventListItemView {
  id: string;
  title: string;
  coverImageUrl: string | null;
  addressText: string;
  startAt: Date;
  endAt: Date | null;
  capacity: number;
  attendeeCount: number;
  priceKobo: number | null;
  drinkCategory: Event['drinkCategory'];
  status: Event['status'];
  isEnded: boolean;
  host: { id: string; displayName: string | null; photoUrl: string | null };
}

export type EventDetailView = EventListItemView & {
  description: string | null;
  latitude: number;
  longitude: number;
  privacy: Event['privacy'];
  cancelReason: string | null;
};

function isEnded(event: Pick<Event, 'startAt' | 'endAt'>): boolean {
  return (event.endAt ?? event.startAt) < new Date();
}

function toListItem(event: EventWithHost): EventListItemView {
  return {
    id: event.id,
    title: event.title,
    coverImageUrl: event.coverImageUrl,
    addressText: event.addressText,
    startAt: event.startAt,
    endAt: event.endAt,
    capacity: event.capacity,
    attendeeCount: event._count.rsvps,
    priceKobo: event.priceKobo,
    drinkCategory: event.drinkCategory,
    status: event.status,
    isEnded: isEnded(event),
    host: {
      id: event.host.id,
      displayName: event.host.profile?.displayName ?? null,
      photoUrl: event.host.profile?.photoUrl ?? null,
    },
  };
}

function toDetailView(event: EventWithHost): EventDetailView {
  return {
    ...toListItem(event),
    description: event.description,
    latitude: event.latitude,
    longitude: event.longitude,
    privacy: event.privacy,
    cancelReason: event.cancelReason,
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
  _count: {
    select: {
      rsvps: { where: { status: { in: ['APPROVED', 'ATTENDED'] as const } } },
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

    const { latitude, longitude } = await this.resolveLocation(
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
          addressText: dto.addressText,
          latitude,
          longitude,
          startAt,
          endAt,
          capacity: dto.capacity,
          priceKobo: dto.priceKobo,
          coverImageUrl: dto.coverImageUrl,
          drinkCategory: dto.drinkCategory,
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

  async getById(id: string): Promise<EventDetailView> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: attendeeInclude,
    });
    if (!event) {
      throw new AppException(
        'EVENT_NOT_FOUND',
        'Hangout not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return toDetailView(event);
  }

  async list(
    query: ListEventsQueryDto,
  ): Promise<CursorPage<EventListItemView>> {
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;

    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      privacy: 'PUBLIC',
    };

    if (query.tonight) {
      const now = new Date();
      where.startAt = {
        gte: now,
        lte: new Date(now.getTime() + TONIGHT_WINDOW_MS),
      };
    } else {
      where.startAt = { gte: new Date() };
    }

    if (query.nonAlcoholic) {
      where.drinkCategory = { in: ['NON_ALCOHOLIC', 'BOTH'] };
    }

    if (query.underTwoK) {
      where.OR = [
        { priceKobo: null },
        { priceKobo: { lte: UNDER_TWO_K_KOBO } },
      ];
    }

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

    return { items: page.map(toListItem), nextCursor };
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDetailView> {
    const existing = await this.prisma.event.findUniqueOrThrow({
      where: { id },
    });

    let latitude = existing.latitude;
    let longitude = existing.longitude;
    let locationChanged = false;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
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
          ...(dto.priceKobo !== undefined && { priceKobo: dto.priceKobo }),
          ...(dto.coverImageUrl !== undefined && {
            coverImageUrl: dto.coverImageUrl,
          }),
          ...(dto.drinkCategory !== undefined && {
            drinkCategory: dto.drinkCategory,
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
