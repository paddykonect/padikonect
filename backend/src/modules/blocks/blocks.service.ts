import { HttpStatus, Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { PadiUserView, padiUserSelect, toPadiUser } from '../padis/padi-user';

export interface BlockedUserView {
  user: PadiUserView;
  blockedAt: Date;
}

// Blocks are one-way to create but hide both people from each other: the
// blocked person sees the blocker as "not found" (no notification), and the
// blocker no longer sees them either.
@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) {
      throw new AppException(
        'BLOCK_SELF',
        "You can't block yourself.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { status: true },
    });
    if (!target || target.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'USER_NOT_FOUND',
        'That person could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: {
          blockerId_blockedId: { blockerId: userId, blockedId: targetId },
        },
        create: { blockerId: userId, blockedId: targetId },
        update: {},
      }),
      // Blocking also ends the padi connection in both directions, which in
      // turn removes them from statuses, PadiRadar and direct-chat eligibility.
      this.prisma.padiConnection.deleteMany({
        where: {
          OR: [
            { userId, padiId: targetId },
            { userId: targetId, padiId: userId },
          ],
        },
      }),
    ]);
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { blockerId: userId, blockedId: targetId },
    });
  }

  async list(userId: string): Promise<BlockedUserView[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: padiUserSelect } },
    });
    return rows.map((r) => ({
      user: toPadiUser(r.blocked),
      blockedAt: r.createdAt,
    }));
  }

  /** Everyone hidden from this user: people they blocked and people who blocked them. */
  async hiddenUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((r) =>
      r.blockerId === userId ? r.blockedId : r.blockerId,
    );
  }

  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { blockerId: true },
    });
    return row !== null;
  }

  /** Throws the same "not found" as a missing user, so a block is never revealed. */
  async assertNotBlocked(viewerId: string, otherId: string): Promise<void> {
    if (await this.isBlockedEitherWay(viewerId, otherId)) {
      throw new AppException(
        'USER_NOT_FOUND',
        'That person could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
