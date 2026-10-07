import { HttpStatus, Injectable } from '@nestjs/common';
import { Venue } from '@prisma/client';
import { CursorPage } from '../../common/dto/cursor-pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { ReviewVenueDto } from './dto/review-venue.dto';

export interface VenueView {
  id: string;
  name: string;
  category: Venue['category'];
  addressText: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  isFavorite: boolean;
}

export interface VenueReviewView {
  id: string;
  rating: number;
  body: string;
  createdAt: Date;
  user: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface VenueDetailView extends VenueView {
  description: string | null;
  phone: string | null;
  photos: string[];
  amenities: string[];
  opensAt: string | null;
  closesAt: string | null;
  rating: { average: number | null; count: number };
  menu: Array<{
    section: string;
    items: Array<{ id: string; name: string; priceKobo: number }>;
  }>;
  reviews: VenueReviewView[];
  myReview: { rating: number; body: string } | null;
}

const FAVORITES_LIMIT = 30;
const REVIEWS_LIMIT = 20;

function toView(venue: Venue, isFavorite: boolean): VenueView {
  return {
    id: venue.id,
    name: venue.name,
    category: venue.category,
    addressText: venue.addressText,
    latitude: venue.latitude,
    longitude: venue.longitude,
    coverImageUrl: venue.coverImageUrl,
    isFavorite,
  };
}

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListVenuesQueryDto,
  ): Promise<CursorPage<VenueView>> {
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;
    const venues = await this.prisma.venue.findMany({
      where: {
        ...(query.category && { category: query.category }),
        ...(query.q && {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            {
              addressText: { contains: query.q, mode: 'insensitive' as const },
            },
          ],
        }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
      include: { favorites: { where: { userId }, select: { userId: true } } },
    });
    const hasMore = venues.length > query.limit;
    const page = hasMore ? venues.slice(0, query.limit) : venues;
    return {
      items: page.map((v) => toView(v, v.favorites.length > 0)),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1].id) : null,
    };
  }

  async listFavorites(userId: string): Promise<VenueView[]> {
    const favorites = await this.prisma.venueFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: FAVORITES_LIMIT,
      include: { venue: true },
    });
    return favorites.map((f) => toView(f.venue, true));
  }

  // Idempotent: favouriting twice (or removing a non-favourite) is a no-op.
  async addFavorite(userId: string, venueId: string): Promise<void> {
    await this.assertExists(venueId);
    await this.prisma.venueFavorite.upsert({
      where: { userId_venueId: { userId, venueId } },
      create: { userId, venueId },
      update: {},
    });
  }

  async removeFavorite(userId: string, venueId: string): Promise<void> {
    await this.prisma.venueFavorite.deleteMany({ where: { userId, venueId } });
  }

  private async assertExists(venueId: string): Promise<void> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });
    if (!venue) {
      throw new AppException(
        'VENUE_NOT_FOUND',
        'Place not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /** Figma "Venue detail" — overview, menu and reviews in one payload. */
  async getById(userId: string, venueId: string): Promise<VenueDetailView> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        favorites: { where: { userId }, select: { userId: true } },
        menuItems: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!venue) {
      throw new AppException(
        'VENUE_NOT_FOUND',
        'Place not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const [agg, reviews, mine] = await Promise.all([
      this.prisma.venueReview.aggregate({
        where: { venueId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.venueReview.findMany({
        where: { venueId },
        orderBy: { createdAt: 'desc' },
        take: REVIEWS_LIMIT,
        include: {
          user: { select: { id: true, fullName: true, profile: true } },
        },
      }),
      this.prisma.venueReview.findUnique({
        where: { venueId_userId: { venueId, userId } },
        select: { rating: true, body: true },
      }),
    ]);

    // Menu sections keep the order of their first item.
    const sections = new Map<string, VenueDetailView['menu'][number]>();
    for (const item of venue.menuItems) {
      if (!sections.has(item.section))
        sections.set(item.section, { section: item.section, items: [] });
      sections.get(item.section)!.items.push({
        id: item.id,
        name: item.name,
        priceKobo: item.priceKobo,
      });
    }

    return {
      ...toView(venue, venue.favorites.length > 0),
      description: venue.description,
      phone: venue.phone,
      photos: venue.photos,
      amenities: venue.amenities,
      opensAt: venue.opensAt,
      closesAt: venue.closesAt,
      rating: {
        average:
          agg._avg.rating === null
            ? null
            : Math.round(agg._avg.rating * 10) / 10,
        count: agg._count._all,
      },
      menu: [...sections.values()],
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
        user: {
          id: r.user.id,
          displayName: r.user.profile?.displayName ?? r.user.fullName,
          photoUrl: r.user.profile?.photoUrl ?? null,
        },
      })),
      myReview: mine,
    };
  }

  // One review per padi: writing again replaces it.
  async review(
    userId: string,
    venueId: string,
    dto: ReviewVenueDto,
  ): Promise<{ message: string }> {
    await this.assertExists(venueId);
    await this.prisma.venueReview.upsert({
      where: { venueId_userId: { venueId, userId } },
      create: { venueId, userId, rating: dto.rating, body: dto.body.trim() },
      update: { rating: dto.rating, body: dto.body.trim() },
    });
    return { message: 'Review saved.' };
  }
}
