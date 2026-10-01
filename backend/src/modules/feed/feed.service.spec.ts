/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { FeedService } from './feed.service';

function makePost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'post-1',
    authorId: 'user-1',
    type: 'MOMENT',
    caption: 'hello',
    visibility: 'PUBLIC',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    media: [],
    author: { id: 'user-1', profile: { displayName: 'Ada', photoUrl: null } },
    ...overrides,
  };
}

function makeService(posts: ReturnType<typeof makePost>[] = []) {
  const prisma = {
    post: {
      findMany: jest.fn().mockResolvedValue(posts),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const cloudinary = {
    getSignedUploadParams: jest.fn().mockReturnValue({ signature: 'sig' }),
  } as unknown as CloudinaryService;
  return { service: new FeedService(prisma, cloudinary), prisma, cloudinary };
}

describe('FeedService', () => {
  describe('list (cursor pagination)', () => {
    it('requests one extra row and reports no nextCursor when the page is not full', async () => {
      const { service, prisma } = makeService([
        makePost({ id: 'a' }),
        makePost({ id: 'b' }),
      ]);
      const page = await service.list({ limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }),
      );
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBeNull();
    });

    it('trims the extra row and returns an opaque nextCursor when there are more results', async () => {
      const posts = Array.from({ length: 3 }, (_, i) =>
        makePost({ id: `p${i}` }),
      );
      const { service } = makeService(posts);
      const page = await service.list({ limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).not.toBeNull();
      const decoded = Buffer.from(
        page.nextCursor as string,
        'base64url',
      ).toString('utf8');
      expect(decoded).toBe('p1');
    });

    it('decodes an incoming cursor into a Prisma cursor+skip clause', async () => {
      const { service, prisma } = makeService([]);
      const cursor = Buffer.from('post-5', 'utf8').toString('base64url');
      await service.list({ cursor, limit: 20 });

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'post-5' }, skip: 1 }),
      );
    });
  });

  describe('create', () => {
    it('rejects a post with neither caption nor media', async () => {
      const { service } = makeService();
      await expect(service.create('user-1', {})).rejects.toMatchObject({
        code: 'POST_EMPTY',
      });
    });

    it('accepts a media-only post', async () => {
      const { service, prisma } = makeService();
      (prisma.post.create as jest.Mock).mockResolvedValue(makePost());

      await service.create('user-1', {
        media: [
          {
            url: 'https://res.cloudinary.com/x.jpg',
            publicId: 'posts/user-1/x',
            type: 'IMAGE',
          },
        ],
      });

      expect(prisma.post.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws POST_NOT_FOUND for a missing or already-deleted post', async () => {
      const { service, prisma } = makeService();
      (prisma.post.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.remove('user-1', 'missing')).rejects.toMatchObject({
        code: 'POST_NOT_FOUND',
      });
    });

    it('throws POST_NOT_OWNED when the caller is not the author', async () => {
      const { service, prisma } = makeService();
      (prisma.post.findUnique as jest.Mock).mockResolvedValue(
        makePost({ authorId: 'someone-else' }),
      );
      await expect(service.remove('user-1', 'post-1')).rejects.toMatchObject({
        code: 'POST_NOT_OWNED',
      });
    });

    it('soft-deletes when the caller owns the post', async () => {
      const { service, prisma } = makeService();
      (prisma.post.findUnique as jest.Mock).mockResolvedValue(
        makePost({ authorId: 'user-1' }),
      );
      await service.remove('user-1', 'post-1');

      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { isDeleted: true },
      });
    });
  });
});
