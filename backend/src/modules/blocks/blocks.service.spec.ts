/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain object literals */
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from './blocks.service';

function makeService() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    block: {
      upsert: jest.fn().mockReturnValue('upsert'),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    padiConnection: { deleteMany: jest.fn().mockReturnValue('deleteMany') },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  return { service: new BlocksService(prisma), prisma };
}

describe('BlocksService', () => {
  it("won't let you block yourself", async () => {
    const { service } = makeService();
    await expect(service.block('u1', 'u1')).rejects.toMatchObject({
      code: 'BLOCK_SELF',
    });
  });

  it('ends the padi connection in both directions when blocking', async () => {
    const { service, prisma } = makeService();
    await service.block('u1', 'u2');
    expect(prisma.padiConnection.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 'u1', padiId: 'u2' },
          { userId: 'u2', padiId: 'u1' },
        ],
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['upsert', 'deleteMany']);
  });

  it('hides people you blocked and people who blocked you', async () => {
    const { service, prisma } = makeService();
    (prisma.block.findMany as jest.Mock).mockResolvedValue([
      { blockerId: 'u1', blockedId: 'u2' },
      { blockerId: 'u3', blockedId: 'u1' },
    ]);
    expect(await service.hiddenUserIds('u1')).toEqual(['u2', 'u3']);
  });

  it('reports a block as "not found" so it is never revealed', async () => {
    const { service, prisma } = makeService();
    (prisma.block.findFirst as jest.Mock).mockResolvedValue({
      blockerId: 'u2',
    });
    await expect(service.assertNotBlocked('u1', 'u2')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
