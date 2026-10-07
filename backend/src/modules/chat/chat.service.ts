import { HttpStatus, Injectable } from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { PadiUserView, padiUserSelect, toPadiUser } from '../padis/padi-user';
import { ChatGateway } from './chat.gateway';

export interface MessageView {
  id: string;
  conversationId: string;
  clientId: string;
  body: string;
  createdAt: Date;
  sender: PadiUserView;
}

export interface ConversationView {
  id: string;
  type: 'DIRECT' | 'EVENT' | 'COMMUNITY';
  title: string;
  imageUrl: string | null;
  emoji: string | null;
  subtitle: string;
  eventId: string | null;
  otherUserId: string | null;
  memberCount: number;
  lastMessage: { body: string; createdAt: Date; senderId: string } | null;
  unread: boolean;
}

const conversationInclude = {
  event: {
    select: { id: true, title: true, coverImageUrl: true, startAt: true },
  },
  community: { select: { name: true, emoji: true } },
  participants: {
    where: { leftAt: null },
    select: {
      userId: true,
      lastReadAt: true,
      user: { select: padiUserSelect },
    },
  },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

const messageInclude = {
  sender: { select: padiUserSelect },
} satisfies Prisma.MessageInclude;

function toMessage(
  m: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
): MessageView {
  return {
    id: m.id,
    conversationId: m.conversationId,
    clientId: m.clientId,
    body: m.body,
    createdAt: m.createdAt,
    sender: toPadiUser(m.sender),
  };
}

// "Fri, 8:00 PM" in Lagos time, matching the Figma chat header.
function formatEventTime(date: Date): string {
  const opts = { timeZone: 'Africa/Lagos' } as const;
  const day = date.toLocaleString('en-US', { ...opts, weekday: 'short' });
  const time = date.toLocaleString('en-US', {
    ...opts,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${day}, ${time}`;
}

function directKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
    private readonly blocks: BlocksService,
  ) {}

  private toView(userId: string, c: ConversationRow): ConversationView {
    const me = c.participants.find((p) => p.userId === userId);
    const last = c.messages[0] ?? null;
    const unread =
      !!last &&
      last.senderId !== userId &&
      (!me?.lastReadAt || last.createdAt > me.lastReadAt);

    if (c.type === 'EVENT' && c.event) {
      return {
        id: c.id,
        type: 'EVENT',
        title: c.event.title,
        imageUrl: c.event.coverImageUrl,
        emoji: null,
        subtitle: `${c.participants.length} padi${c.participants.length === 1 ? '' : 's'} · ${formatEventTime(c.event.startAt)}`,
        eventId: c.event.id,
        otherUserId: null,
        memberCount: c.participants.length,
        lastMessage: last && {
          body: last.body,
          createdAt: last.createdAt,
          senderId: last.senderId,
        },
        unread,
      };
    }
    if (c.type === 'COMMUNITY' && c.community) {
      return {
        id: c.id,
        type: 'COMMUNITY',
        title: c.community.name,
        imageUrl: null,
        emoji: c.community.emoji,
        subtitle: `${c.participants.length} member${c.participants.length === 1 ? '' : 's'}`,
        eventId: null,
        otherUserId: null,
        memberCount: c.participants.length,
        lastMessage: last && {
          body: last.body,
          createdAt: last.createdAt,
          senderId: last.senderId,
        },
        unread,
      };
    }
    const other = c.participants.find((p) => p.userId !== userId)?.user;
    const otherView = other ? toPadiUser(other) : null;
    return {
      id: c.id,
      type: 'DIRECT',
      title: otherView?.displayName ?? 'Padi',
      imageUrl: otherView?.photoUrl ?? null,
      emoji: null,
      subtitle: 'Direct message',
      eventId: null,
      otherUserId: otherView?.id ?? null,
      memberCount: c.participants.length,
      lastMessage: last && {
        body: last.body,
        createdAt: last.createdAt,
        senderId: last.senderId,
      },
      unread,
    };
  }

  private async getParticipating(
    userId: string,
    conversationId: string,
  ): Promise<ConversationRow> {
    const c = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId, leftAt: null } },
      },
      include: conversationInclude,
    });
    if (!c) {
      throw new AppException(
        'CONVERSATION_NOT_FOUND',
        'Chat not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return c;
  }

  async list(userId: string): Promise<ConversationView[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId, leftAt: null } } },
      include: conversationInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 100,
    });
    // Direct chats with someone blocked (either way) drop out of the list.
    const hidden = new Set(await this.blocks.hiddenUserIds(userId));
    return rows
      .filter(
        (c) =>
          c.type !== 'DIRECT' ||
          !c.participants.some((p) => hidden.has(p.userId)),
      )
      .map((c) => this.toView(userId, c));
  }

  async get(userId: string, conversationId: string): Promise<ConversationView> {
    return this.toView(
      userId,
      await this.getParticipating(userId, conversationId),
    );
  }

  /** Finds or creates the one-to-one chat with a padi (either direction). */
  async openDirect(userId: string, otherId: string): Promise<ConversationView> {
    if (userId === otherId) {
      throw new AppException(
        'CHAT_SELF',
        "You can't message yourself.",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.blocks.assertNotBlocked(userId, otherId);
    const [other, link] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: otherId },
        select: { status: true },
      }),
      this.prisma.padiConnection.findFirst({
        where: {
          OR: [
            { userId, padiId: otherId },
            { userId: otherId, padiId: userId },
          ],
        },
      }),
    ]);
    if (!other || other.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'USER_NOT_FOUND',
        'That person could not be found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!link) {
      throw new AppException(
        'NOT_PADIS',
        'Add them as a padi before messaging.',
        HttpStatus.FORBIDDEN,
      );
    }

    const key = directKey(userId, otherId);
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey: key },
      include: conversationInclude,
    });
    if (existing) return this.toView(userId, existing);
    try {
      const created = await this.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          directKey: key,
          participants: {
            create: [{ userId }, { userId: otherId }],
          },
        },
        include: conversationInclude,
      });
      return this.toView(userId, created);
    } catch (err) {
      // Both padis opened the chat at the same moment — use the winner's row.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const row = await this.prisma.conversation.findUniqueOrThrow({
          where: { directKey: key },
          include: conversationInclude,
        });
        return this.toView(userId, row);
      }
      throw err;
    }
  }

  /** Newest page first in the query, returned oldest → newest for display. */
  async messages(
    userId: string,
    conversationId: string,
    before: string | undefined,
    limit: number,
  ): Promise<{ items: MessageView[]; hasMore: boolean }> {
    await this.getParticipating(userId, conversationId);
    const cursor = before
      ? await this.prisma.message.findFirst({
          where: { id: before, conversationId },
          select: { createdAt: true },
        })
      : null;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor && { createdAt: { lt: cursor.createdAt } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: messageInclude,
    });
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).reverse().map(toMessage),
      hasMore,
    };
  }

  async send(
    userId: string,
    conversationId: string,
    body: string,
    clientId: string,
  ): Promise<MessageView> {
    const conversation = await this.getParticipating(userId, conversationId);
    const other =
      conversation.type === 'DIRECT'
        ? conversation.participants.find((p) => p.userId !== userId)
        : undefined;
    if (other && (await this.blocks.isBlockedEitherWay(userId, other.userId))) {
      throw new AppException(
        'CHAT_BLOCKED',
        "You can't message this person.",
        HttpStatus.FORBIDDEN,
      );
    }
    const text = body.trim();
    if (!text) {
      throw new AppException(
        'MESSAGE_EMPTY',
        "Message can't be empty.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Idempotent retry: the same (sender, clientId) returns the original.
    const duplicate = await this.prisma.message.findUnique({
      where: { senderId_clientId: { senderId: userId, clientId } },
      include: messageInclude,
    });
    if (duplicate) return toMessage(duplicate);

    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: userId, body: text, clientId },
        include: messageInclude,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now },
      });
      return created;
    });

    const view = toMessage(message);
    this.gateway.emitToUsers(
      conversation.participants.map((p) => p.userId),
      'message:new',
      view,
    );
    return view;
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.getParticipating(userId, conversationId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }
}
