import { BlocksService } from '../blocks/blocks.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Post, PostMedia } from '@prisma/client';
import {
  CursorPage,
  CursorPaginationQueryDto,
} from '../../common/dto/cursor-pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CreatePostDto } from './dto/create-post.dto';

const POST_MEDIA_FOLDER = 'posts';

type PostWithMedia = Post & {
  media: PostMedia[];
  author: {
    id: string;
    profile: { displayName: string | null; photoUrl: string | null } | null;
  };
};

export interface PostView {
  id: string;
  caption: string | null;
  type: Post['type'];
  createdAt: Date;
  author: { id: string; displayName: string | null; photoUrl: string | null };
  media: Array<{
    url: string;
    type: PostMedia['type'];
    width: number | null;
    height: number | null;
    durationMs: number | null;
  }>;
}

function toPostView(post: PostWithMedia): PostView {
  return {
    id: post.id,
    caption: post.caption,
    type: post.type,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      displayName: post.author.profile?.displayName ?? null,
      photoUrl: post.author.profile?.photoUrl ?? null,
    },
    media: post.media
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        url: m.url,
        type: m.type,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
      })),
  };
}

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly blocks: BlocksService,
  ) {}

  /** Posts by people blocked either way are left out for the viewer. */
  async list(
    query: CursorPaginationQueryDto,
    viewerId?: string,
  ): Promise<CursorPage<PostView>> {
    const cursorId = query.cursor ? decodeCursor(query.cursor) : undefined;
    const hidden = viewerId ? await this.blocks.hiddenUserIds(viewerId) : [];

    const posts = await this.prisma.post.findMany({
      where: {
        isDeleted: false,
        visibility: 'PUBLIC',
        ...(hidden.length && { authorId: { notIn: hidden } }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
      include: { media: true, author: { select: { id: true, profile: true } } },
    });

    const hasMore = posts.length > query.limit;
    const page = hasMore ? posts.slice(0, query.limit) : posts;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1].id) : null;

    return { items: page.map(toPostView), nextCursor };
  }

  getMediaUploadSignature(userId: string) {
    return this.cloudinary.getSignedUploadParams(
      `${POST_MEDIA_FOLDER}/${userId}`,
    );
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostView> {
    if (!dto.caption && (!dto.media || dto.media.length === 0)) {
      throw new AppException(
        'POST_EMPTY',
        'A post needs a caption or at least one photo/video.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        type: dto.type,
        caption: dto.caption,
        media: dto.media
          ? {
              create: dto.media.map((m, index) => ({
                url: m.url,
                publicId: m.publicId,
                type: m.type,
                width: m.width,
                height: m.height,
                durationMs: m.durationMs,
                position: index,
              })),
            }
          : undefined,
      },
      include: { media: true, author: { select: { id: true, profile: true } } },
    });

    return toPostView(post);
  }

  async remove(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.isDeleted) {
      throw new AppException(
        'POST_NOT_FOUND',
        'Post not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    // Admin override arrives with RolesGuard in the Admin phase — owner-only for now.
    if (post.authorId !== userId) {
      throw new AppException(
        'POST_NOT_OWNED',
        'You can only delete your own posts.',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { isDeleted: true },
    });
  }
}
