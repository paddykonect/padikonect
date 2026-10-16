import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';

export interface CommunityAdmin {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
}

export interface CommunityView {
  id: string;
  name: string;
  description: string;
  emoji: string;
  city: string;
  minAge: number;
  maxAge: number;
  coverImageUrl: string | null;
  memberCount: number;
  isMember: boolean;
  isOwner: boolean;
  isFavorite: boolean;
  admin: CommunityAdmin | null;
  conversationId: string | null;
}

export interface CommunityChatInfo {
  conversationId: string;
  unread: number;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
}

export interface CommunityDetailView extends CommunityView {
  vibe: string[];
  rules: string[];
  eventCount: number;
  // Only populated for members (the chat preview row).
  chat: CommunityChatInfo | null;
}

export interface CommunityMemberView {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  role: string;
  joinedAt: Date;
}

export interface CommunityEventView {
  id: string;
  title: string;
  coverImageUrl: string | null;
  emoji: string | null;
  startAt: Date;
  addressText: string;
}

const include = {
  _count: { select: { members: true } },
  conversation: { select: { id: true } },
  creator: {
    select: {
      id: true,
      fullName: true,
      profile: { select: { displayName: true, photoUrl: true } },
    },
  },
} satisfies Prisma.CommunityInclude;

type CommunityRow = Prisma.CommunityGetPayload<{ include: typeof include }>;

const LIST_LIMIT = 50;
const MEMBER_PREVIEW = 30;

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async membership(userId: string) {
    const rows = await this.prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true, role: true },
    });
    return new Map(rows.map((r) => [r.communityId, r.role]));
  }

  private async favoriteIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.communityFavorite.findMany({
      where: { userId },
      select: { communityId: true },
    });
    return new Set(rows.map((r) => r.communityId));
  }

  private toView(
    c: CommunityRow,
    role: string | undefined,
    isFavorite: boolean,
  ): CommunityView {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      emoji: c.emoji,
      city: c.city,
      minAge: c.minAge,
      maxAge: c.maxAge,
      coverImageUrl: c.coverImageUrl,
      memberCount: c._count.members,
      isMember: !!role,
      isOwner: role === 'OWNER',
      isFavorite,
      admin: {
        id: c.creator.id,
        displayName: c.creator.profile?.displayName ?? c.creator.fullName,
        photoUrl: c.creator.profile?.photoUrl ?? null,
      },
      // Only members get the chat link.
      conversationId: role ? (c.conversation?.id ?? null) : null,
    };
  }

  private async userCity(userId: string): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { state: true, country: true },
    });
    return profile?.state ?? profile?.country ?? null;
  }

  /** "Popular near you": your city first, then by member count. */
  async list(userId: string, mine: boolean): Promise<CommunityView[]> {
    const [roles, favs, city] = await Promise.all([
      this.membership(userId),
      this.favoriteIds(userId),
      this.userCity(userId),
    ]);
    const rows = await this.prisma.community.findMany({
      where: mine ? { members: { some: { userId } } } : undefined,
      include,
      orderBy: [{ members: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: LIST_LIMIT,
    });
    const near = (c: CommunityRow) =>
      city && c.city.toLowerCase() === city.toLowerCase() ? 0 : 1;
    return rows
      .sort((a, b) => near(a) - near(b))
      .map((c) => this.toView(c, roles.get(c.id), favs.has(c.id)));
  }

  /** The Favorite communities page — most recently saved first. */
  async listFavorites(userId: string): Promise<CommunityView[]> {
    const roles = await this.membership(userId);
    const rows = await this.prisma.communityFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { community: { include } },
    });
    return rows.map((f) =>
      this.toView(f.community, roles.get(f.communityId), true),
    );
  }

  async getById(
    userId: string,
    communityId: string,
  ): Promise<CommunityDetailView> {
    const c = await this.getRow(communityId);
    const [roles, favs] = await Promise.all([
      this.membership(userId),
      this.favoriteIds(userId),
    ]);
    const role = roles.get(communityId);
    const base = this.toView(c, role, favs.has(communityId));

    const eventCount = await this.prisma.event.count({
      where: { communityId, status: 'PUBLISHED' },
    });

    let chat: CommunityChatInfo | null = null;
    if (role && c.conversation) {
      const conversationId = c.conversation.id;
      const [last, participant] = await Promise.all([
        this.prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: {
            body: true,
            createdAt: true,
            sender: {
              select: {
                fullName: true,
                profile: { select: { displayName: true } },
              },
            },
          },
        }),
        this.prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
          select: { lastReadAt: true },
        }),
      ]);
      const unread = await this.prisma.message.count({
        where: {
          conversationId,
          senderId: { not: userId },
          createdAt: { gt: participant?.lastReadAt ?? new Date(0) },
        },
      });
      const senderName = last
        ? (last.sender.profile?.displayName ?? last.sender.fullName)
        : null;
      chat = {
        conversationId,
        unread,
        lastMessagePreview: last ? `${senderName}: ${last.body}` : null,
        lastMessageAt: last?.createdAt ?? null,
      };
    }

    return {
      ...base,
      vibe: c.vibe,
      rules: c.rules,
      eventCount,
      chat,
    };
  }

  /** Owner (Admin) first, then members by join date; capped for the preview. */
  async members(communityId: string): Promise<CommunityMemberView[]> {
    await this.getRow(communityId);
    const rows = await this.prisma.communityMember.findMany({
      where: { communityId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      take: MEMBER_PREVIEW,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profile: { select: { displayName: true, photoUrl: true } },
          },
        },
      },
    });
    return rows.map((m) => ({
      id: m.user.id,
      displayName: m.user.profile?.displayName ?? m.user.fullName,
      photoUrl: m.user.profile?.photoUrl ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** The community's hangouts (the Events tab). */
  async events(communityId: string): Promise<CommunityEventView[]> {
    await this.getRow(communityId);
    const rows = await this.prisma.event.findMany({
      where: { communityId, status: 'PUBLISHED' },
      orderBy: { startAt: 'asc' },
      take: 50,
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        emoji: true,
        startAt: true,
        addressText: true,
      },
    });
    return rows;
  }

  async setFavorite(
    userId: string,
    communityId: string,
    favorite: boolean,
  ): Promise<void> {
    await this.getRow(communityId);
    if (favorite) {
      await this.prisma.communityFavorite.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId },
        update: {},
      });
    } else {
      await this.prisma.communityFavorite.deleteMany({
        where: { communityId, userId },
      });
    }
  }

  async report(
    userId: string,
    communityId: string,
    reason?: string,
  ): Promise<void> {
    const c = await this.getRow(communityId);
    const note = reason?.trim();
    await this.prisma.supportMessage.create({
      data: {
        userId,
        topic: 'OTHER',
        message: `Report community "${c.name}" (${communityId})${note ? `: ${note}` : ''}`,
      },
    });
  }

  async create(
    userId: string,
    dto: CreateCommunityDto,
  ): Promise<CommunityView> {
    const minAge = dto.minAge ?? 18;
    const maxAge = dto.maxAge ?? 99;
    if (minAge > maxAge) {
      throw new AppException(
        'INVALID_AGE_RANGE',
        'The minimum age must be below the maximum age.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const city = dto.city?.trim() || (await this.userCity(userId)) || 'Lagos';
    const created = await this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: dto.name.trim(),
          description: dto.description.trim(),
          emoji: dto.emoji,
          city,
          minAge,
          maxAge,
          coverImageUrl: dto.coverImageUrl,
          coverImagePublicId: dto.coverImagePublicId,
          vibe: dto.vibe ?? [],
          rules: dto.rules ?? [],
          creatorId: userId,
          members: { create: { userId, role: 'OWNER' } },
        },
      });
      await tx.conversation.create({
        data: {
          type: 'COMMUNITY',
          communityId: community.id,
          participants: { create: { userId } },
        },
      });
      return tx.community.findUniqueOrThrow({
        where: { id: community.id },
        include,
      });
    });
    return this.toView(created, 'OWNER', false);
  }

  async join(userId: string, communityId: string): Promise<CommunityView> {
    const community = await this.getRow(communityId);
    await this.prisma.$transaction(async (tx) => {
      await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId },
        update: {},
      });
      if (community.conversation) {
        await tx.conversationParticipant.upsert({
          where: {
            conversationId_userId: {
              conversationId: community.conversation.id,
              userId,
            },
          },
          create: { conversationId: community.conversation.id, userId },
          update: { leftAt: null },
        });
      }
    });
    const [roles, favs] = await Promise.all([
      this.membership(userId),
      this.favoriteIds(userId),
    ]);
    return this.toView(
      await this.getRow(communityId),
      roles.get(communityId),
      favs.has(communityId),
    );
  }

  async leave(userId: string, communityId: string): Promise<void> {
    const community = await this.getRow(communityId);
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) return;
    if (member.role === 'OWNER') {
      throw new AppException(
        'OWNER_CANNOT_LEAVE',
        "You started this community, so you can't leave it.",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.communityMember.delete({
        where: { communityId_userId: { communityId, userId } },
      });
      if (community.conversation) {
        await tx.conversationParticipant.updateMany({
          where: { conversationId: community.conversation.id, userId },
          data: { leftAt: new Date() },
        });
      }
    });
  }

  private async getRow(communityId: string): Promise<CommunityRow> {
    const row = await this.prisma.community.findUnique({
      where: { id: communityId },
      include,
    });
    if (!row) {
      throw new AppException(
        'COMMUNITY_NOT_FOUND',
        'Community not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}
