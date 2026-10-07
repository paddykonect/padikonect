import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';

export interface CommunityView {
  id: string;
  name: string;
  description: string;
  emoji: string;
  city: string;
  minAge: number;
  maxAge: number;
  memberCount: number;
  isMember: boolean;
  isOwner: boolean;
  conversationId: string | null;
}

const include = {
  _count: { select: { members: true } },
  conversation: { select: { id: true } },
} satisfies Prisma.CommunityInclude;

type CommunityRow = Prisma.CommunityGetPayload<{ include: typeof include }>;

const LIST_LIMIT = 50;

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

  private toView(c: CommunityRow, role: string | undefined): CommunityView {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      emoji: c.emoji,
      city: c.city,
      minAge: c.minAge,
      maxAge: c.maxAge,
      memberCount: c._count.members,
      isMember: !!role,
      isOwner: role === 'OWNER',
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
    const [roles, city] = await Promise.all([
      this.membership(userId),
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
      .map((c) => this.toView(c, roles.get(c.id)));
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
    return this.toView(created, 'OWNER');
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
    const roles = await this.membership(userId);
    return this.toView(await this.getRow(communityId), roles.get(communityId));
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
