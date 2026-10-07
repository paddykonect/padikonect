export type PostType = "MOMENT" | "STORY" | "POLL";
export type MediaType = "IMAGE" | "VIDEO";

export interface Post {
  id: string;
  caption: string | null;
  type: PostType;
  createdAt: string;
  author: { id: string; displayName: string | null; photoUrl: string | null };
  media: Array<{ url: string; type: MediaType; width: number | null; height: number | null; durationMs: number | null }>;
}

export interface PostMediaInput {
  url: string;
  publicId: string;
  type: MediaType;
  width?: number;
  height?: number;
}
