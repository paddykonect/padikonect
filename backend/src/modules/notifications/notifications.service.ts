import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Internal fan-out API for other modules — IN_APP only for now (see plan §Open questions on push). */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, channel: 'IN_APP', title, body, data },
    });
  }

  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        channel: 'IN_APP',
        title,
        body,
        data,
      })),
    });
  }

  async list(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }
}
