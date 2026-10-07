import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { PadiUserView, padiUserSelect, toPadiUser } from './padi-user';
import { PadisService } from './padis.service';

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export interface StatusItemView {
  id: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: Date;
  expiresAt: Date;
  viewed: boolean;
}

export interface StatusGroupView {
  user: PadiUserView;
  isMe: boolean;
  hasUnseen: boolean;
  statuses: StatusItemView[];
}

@Injectable()
export class StatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly padis: PadisService,
  ) {}

  // Housekeeping: hard-delete statuses past their 24h TTL (StatusView rows
  // cascade). The feed/markViewed queries already hide expired statuses via
  // the expiresAt filter; this just keeps the table from growing without
  // bound. Run opportunistically on create rather than via a scheduler — a
  // status post is low-frequency and clears everyone's expired rows at once.
  private async pruneExpired(): Promise<void> {
    await this.prisma.padiStatus.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }

  async create(userId: string, dto: CreateStatusDto): Promise<StatusItemView> {
    const text = dto.text?.trim() || undefined;
    if (!text && !dto.imageUrl) {
      throw new AppException(
        'STATUS_EMPTY',
        'Add some text or a photo to your status.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.pruneExpired();
    const status = await this.prisma.padiStatus.create({
      data: {
        userId,
        text,
        imageUrl: dto.imageUrl,
        expiresAt: new Date(Date.now() + STATUS_TTL_MS),
      },
    });
    return { ...status, viewed: true };
  }

  async remove(userId: string, statusId: string): Promise<void> {
    const { count } = await this.prisma.padiStatus.deleteMany({
      where: { id: statusId, userId },
    });
    if (count === 0) {
      throw new AppException(
        'STATUS_NOT_FOUND',
        'Status not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Your own active statuses first, then your padis' — padis with unseen
   * statuses before fully-seen ones, each most-recent first.
   */
  async feed(userId: string): Promise<StatusGroupView[]> {
    const authorIds = [userId, ...(await this.padis.padiIds(userId))];
    const statuses = await this.prisma.padiStatus.findMany({
      where: { userId: { in: authorIds }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: padiUserSelect },
        views: { where: { viewerId: userId }, select: { viewerId: true } },
      },
    });

    const groups = new Map<string, StatusGroupView>();
    for (const s of statuses) {
      const isMe = s.userId === userId;
      const viewed = isMe || s.views.length > 0;
      let group = groups.get(s.userId);
      if (!group) {
        group = {
          user: toPadiUser(s.user),
          isMe,
          hasUnseen: false,
          statuses: [],
        };
        groups.set(s.userId, group);
      }
      group.hasUnseen ||= !viewed;
      group.statuses.push({
        id: s.id,
        text: s.text,
        imageUrl: s.imageUrl,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewed,
      });
    }

    const latest = (g: StatusGroupView) =>
      g.statuses[g.statuses.length - 1].createdAt.getTime();
    return [...groups.values()].sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return latest(b) - latest(a);
    });
  }

  // Only your own padis' active statuses can be marked viewed.
  async markViewed(userId: string, statusId: string): Promise<void> {
    const status = await this.prisma.padiStatus.findUnique({
      where: { id: statusId },
      select: { userId: true, expiresAt: true },
    });
    const visible =
      status &&
      status.expiresAt > new Date() &&
      (status.userId === userId ||
        (await this.padis.padiIds(userId)).includes(status.userId));
    if (!visible) {
      throw new AppException(
        'STATUS_NOT_FOUND',
        'Status not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (status.userId === userId) return;
    await this.prisma.statusView.upsert({
      where: { statusId_viewerId: { statusId, viewerId: userId } },
      create: { statusId, viewerId: userId },
      update: {},
    });
  }
}
