import { apiRequest } from "@/lib/api/client";
import { SignedUploadParams } from "@/lib/media/cloudinary";
import { Post, PostMediaInput, PostType } from "./types";

export function listPosts(accessToken: string, cursor?: string) {
  const qs = new URLSearchParams({ limit: "20", ...(cursor && { cursor }) });
  return apiRequest<{ items: Post[]; nextCursor: string | null }>(`/feed?${qs}`, { method: "GET", accessToken });
}

export function getMediaUploadSignature(accessToken: string) {
  return apiRequest<SignedUploadParams>("/feed/media-upload-signature", { method: "GET", accessToken });
}

export function createPost(accessToken: string, input: { caption?: string; type?: PostType; media?: PostMediaInput[] }) {
  return apiRequest<Post>("/feed/posts", { body: input, accessToken });
}

export function deletePost(accessToken: string, postId: string) {
  return apiRequest<{ message: string }>(`/feed/posts/${postId}`, { method: "DELETE", accessToken });
}
