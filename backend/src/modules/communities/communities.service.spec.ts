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
  _count: { members: 3 },
  conversation: { id: 'conv1' },
};

function make(member: { role: string } | null = null) {
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
    community: { findUnique: jest.fn().mockResolvedValue(row) },
    communityMember: {
      findUnique: jest.fn().mockResolvedValue(member),
      findMany: jest
        .fn()
        .mockResolvedValue(
          member ? [{ communityId: 'c1', role: member.role }] : [],
        ),
    },
    profile: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ state: 'Lagos', country: 'Nigeria' }),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  return { service: new CommunitiesService(prisma), tx };
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
});
