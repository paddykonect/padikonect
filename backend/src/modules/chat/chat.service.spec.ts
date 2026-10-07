/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { BlocksService } from '../blocks/blocks.service';

function noBlocks() {
  return {
    hiddenUserIds: jest.fn().mockResolvedValue([]),
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    assertNotBlocked: jest.fn(),
  } as unknown as BlocksService;
}

const user = (id: string) => ({ id, fullName: `User ${id}`, profile: null });

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    type: 'DIRECT',
    event: null,
    community: null,
    participants: [
      {
        userId: 'me',
        lastReadAt: new Date('2026-10-01T10:00:00Z'),
        user: user('me'),
      },
      { userId: 'ada', lastReadAt: null, user: user('ada') },
    ],
    messages: [],
    ...overrides,
  };
}

function make(
  opts: { link?: boolean; conv?: unknown; duplicate?: unknown } = {},
) {
  const tx = {
    message: {
      create: jest.fn().mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        clientId: 'k1',
        body: 'hi',
        createdAt: new Date(),
        sender: user('me'),
      }),
    },
    conversation: { update: jest.fn() },
    conversationParticipant: { update: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    padiConnection: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.link ? { userId: 'me' } : null),
    },
    conversation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.conv === undefined ? conversation() : opts.conv,
        ),
      create: jest.fn().mockResolvedValue(conversation()),
    },
    message: {
      findUnique: jest.fn().mockResolvedValue(opts.duplicate ?? null),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const gateway = { emitToUsers: jest.fn() } as unknown as ChatGateway;
  return {
    service: new ChatService(prisma, gateway, noBlocks()),
    prisma,
    gateway,
    tx,
  };
}

describe('ChatService', () => {
  it('only lets padis start a direct chat', async () => {
    const { service } = make({ link: false });
    await expect(service.openDirect('me', 'ada')).rejects.toMatchObject({
      code: 'NOT_PADIS',
    });
  });

  it('creates a direct chat keyed by the sorted user pair', async () => {
    const { service, prisma } = make({ link: true });
    const view = await service.openDirect('me', 'ada');
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ directKey: 'ada:me' }) as object,
      }),
    );
    expect(view.title).toBe('User ada');
  });

  it('sends a message, bumps the thread and notifies every participant', async () => {
    const { service, gateway, tx } = make();
    await service.send('me', 'c1', '  hi  ', 'k1');
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: 'hi' }) as object,
      }),
    );
    expect(gateway.emitToUsers).toHaveBeenCalledWith(
      ['me', 'ada'],
      'message:new',
      expect.anything(),
    );
  });

  it('returns the original message on a retry with the same clientId', async () => {
    const original = {
      id: 'm0',
      conversationId: 'c1',
      clientId: 'k1',
      body: 'hi',
      createdAt: new Date(),
      sender: user('me'),
    };
    const { service, tx, gateway } = make({ duplicate: original });
    const view = await service.send('me', 'c1', 'hi', 'k1');
    expect(view.id).toBe('m0');
    expect(tx.message.create).not.toHaveBeenCalled();
    expect(gateway.emitToUsers).not.toHaveBeenCalled();
  });

  it('rejects blank messages', async () => {
    const { service } = make();
    await expect(service.send('me', 'c1', '   ', 'k1')).rejects.toMatchObject({
      code: 'MESSAGE_EMPTY',
    });
  });

  it("flags a thread unread when someone else's message is newer than lastReadAt", async () => {
    const { service } = make({
      conv: conversation({
        messages: [
          {
            body: 'yo',
            senderId: 'ada',
            createdAt: new Date('2026-10-01T11:00:00Z'),
          },
        ],
      }),
    });
    expect((await service.get('me', 'c1')).unread).toBe(true);
  });

  it("hides chats you aren't part of", async () => {
    const { service } = make({ conv: null });
    await expect(service.get('me', 'c1')).rejects.toMatchObject({
      code: 'CONVERSATION_NOT_FOUND',
    });
  });
});
