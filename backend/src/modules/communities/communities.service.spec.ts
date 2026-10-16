import { PrismaService } from '../../database/prisma.service';
import { CommunitiesService } from './communities.service';

const row = {
  id: 'c1',
  name: 'Lagos Foodies',
  description: 'Suya runs and brunches',
  emoji: '🍽️',
  city: 'Lagos',
  minAge: 18,
  maxAge: 45,
  coverImageUrl: null,
  coverImagePublicId: null,
  vibe: ['Foodie meetups', 'New spots weekly'],
  rules: ['Be kind', 'RSVP if you can show up'],
  _count: { members: 3 },
  conversation: { id: 'conv1' },
  creator: {
    id: 'owner-1',
    fullName: 'Chidi Admin',
    profile: { displayName: 'Chidi', photoUrl: null },
  },
};

function make(member: { role: string } | null = null, favorite = false) {
  const tx = {
    community: {
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
    },
    conversation: { create: jest.fn() },
    communityMember: { upsert: jest.fn(), delete: jest.fn() },
    conversationParticipant: { upsert: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    community: {
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
    },
    communityMember: {
      findUnique: jest.fn().mockResolvedValue(member),
      findMany: jest
        .fn()
        .mockResolvedValue(
          member ? [{ communityId: 'c1', role: member.role }] : [],
        ),
    },
    communityFavorite: {
      findMany: jest
        .fn()
        .mockResolvedValue(favorite ? [{ communityId: 'c1' }] : []),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    event: { count: jest.fn().mockResolvedValue(18), findMany: jest.fn() },
    message: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    conversationParticipant: {
      findUnique: jest.fn().mockResolvedValue({ lastReadAt: null }),
    },
    supportMessage: { create: jest.fn() },
    profile: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ state: 'Lagos', country: 'Nigeria' }),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  return { service: new CommunitiesService(prisma), tx, prisma };
}

describe('CommunitiesService', () => {
  it('rejects an inverted age range', async () => {
    const { service } = make();
    await expect(
      service.create('me', {
        name: 'Crew',
        description: 'A long enough description',
        emoji: '🎉',
        minAge: 40,
        maxAge: 20,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_AGE_RANGE' });
  });

  it("makes the creator owner, opens the group chat and defaults city to the creator's state", async () => {
    const { service, tx } = make();
    const view = await service.create('me', {
      name: 'Crew',
      description: 'A long enough description',
      emoji: '🎉',
    });
    expect(tx.community.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        city: 'Lagos',
        members: { create: { userId: 'me', role: 'OWNER' } },
      }) as object,
    });
    expect(tx.conversation.create).toHaveBeenCalledWith({
      data: {
        type: 'COMMUNITY',
        communityId: 'c1',
        participants: { create: { userId: 'me' } },
      },
    });
    expect(view.isOwner).toBe(true);
    expect(view.admin).toMatchObject({ displayName: 'Chidi' });
  });

  it('joining also adds you to the community chat', async () => {
    const { service, tx } = make({ role: 'MEMBER' });
    const view = await service.join('me', 'c1');
    expect(tx.conversationParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { conversationId: 'conv1', userId: 'me' },
      }),
    );
    expect(view.conversationId).toBe('conv1');
  });

  it("owners can't leave", async () => {
    const { service } = make({ role: 'OWNER' });
    await expect(service.leave('me', 'c1')).rejects.toMatchObject({
      code: 'OWNER_CANNOT_LEAVE',
    });
  });

  it('marks a community as favourited in the view', async () => {
    const { service } = make(null, true);
    const [view] = await service.list('me', false);
    expect(view.isFavorite).toBe(true);
  });

  it('detail exposes vibe/rules/eventCount, and chat only to members', async () => {
    const guest = await make(null).service.getById('me', 'c1');
    expect(guest).toMatchObject({ eventCount: 18, chat: null });
    expect(guest.vibe).toContain('Foodie meetups');

    const member = await make({ role: 'MEMBER' }).service.getById('me', 'c1');
    expect(member.chat).toMatchObject({ conversationId: 'conv1', unread: 0 });
  });

  it('setFavorite upserts / deletes the favorite row', async () => {
    const on = make();
    await on.service.setFavorite('me', 'c1', true);
    expect(
      (on.prisma as unknown as { communityFavorite: { upsert: jest.Mock } })
        .communityFavorite.upsert,
    ).toHaveBeenCalled();

    const off = make();
    await off.service.setFavorite('me', 'c1', false);
    expect(
      (
        off.prisma as unknown as {
          communityFavorite: { deleteMany: jest.Mock };
        }
      ).communityFavorite.deleteMany,
    ).toHaveBeenCalled();
  });

  it('report stores a support message', async () => {
    const { service, prisma } = make();
    await service.report('me', 'c1', 'spam');
    expect(
      (prisma as unknown as { supportMessage: { create: jest.Mock } })
        .supportMessage.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is typed any
        data: expect.objectContaining({ topic: 'OTHER', userId: 'me' }),
      }),
    );
  });
});
