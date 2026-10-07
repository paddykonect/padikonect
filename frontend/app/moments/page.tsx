"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as feedApi from "@/features/feed/api";
import { Post, PostMediaInput } from "@/features/feed/types";
import { FlowScreen } from "@/features/hangouts/components/FlowScreen";
import { CameraIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { ApiError } from "@/lib/api/client";
import { formatRelativeShort } from "@/lib/format/time";
import { cloudinaryDisplayUrl, uploadImageDetailed } from "@/lib/media/cloudinary";

const CAPTION_MAX = 2000;

function Composer({ onPosted }: { onPosted: (post: Post) => void }) {
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<PostMediaInput | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profileName(profile, user?.fullName ?? "");

  async function attach(file: File) {
    if (!accessToken) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImageDetailed(file, await feedApi.getMediaUploadSignature(accessToken));
      setPhoto({ url: uploaded.url, publicId: uploaded.publicId, type: "IMAGE", width: uploaded.width, height: uploaded.height });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function post() {
    if (!accessToken || (!caption.trim() && !photo)) return;
    setPosting(true);
    setError(null);
    try {
      const created = await feedApi.createPost(accessToken, {
        type: "MOMENT",
        ...(caption.trim() && { caption: caption.trim() }),
        ...(photo && { media: [photo] }),
      });
      onPosted(created);
      setCaption("");
      setPhoto(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex gap-3">
        <Avatar name={name} photoUrl={profile?.photoUrl ?? null} size={40} />
        <textarea
          value={caption}
          maxLength={CAPTION_MAX}
          rows={2}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Share a moment from your last hangout…"
          className="min-h-[52px] flex-1 resize-none bg-transparent font-body text-[15px] leading-[22px] text-input-text outline-none placeholder:text-body-text"
        />
      </div>
      {photo && (
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URL, natural aspect ratio */}
          <img src={cloudinaryDisplayUrl(photo.url, { width: 720 })} alt="Attached photo" className="max-h-[320px] w-full object-cover" />
          <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            ×
          </button>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-divider pt-3">
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 font-body text-[13px] font-medium text-heading disabled:opacity-60">
          <CameraIcon size={18} />
          {uploading ? "Uploading…" : photo ? "Change photo" : "Add photo"}
        </button>
        <button
          type="button"
          disabled={posting || uploading || (!caption.trim() && !photo)}
          onClick={() => void post()}
          className="h-9 rounded-full bg-accent px-5 font-body text-[13px] font-bold text-[#1b3b2b] disabled:opacity-50"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void attach(file);
          e.target.value = "";
        }}
      />
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </section>
  );
}

function PostCard({ post, mine, onDelete }: { post: Post; mine: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const name = post.author.displayName ?? "Padi";
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center gap-3">
        <Link href={`/padi/${post.author.id}`} className="flex flex-1 items-center gap-3">
          <Avatar name={name} photoUrl={post.author.photoUrl} size={40} />
          <span>
            <span className="block font-body text-sm font-bold text-heading">{mine ? "You" : name}</span>
            <span className="block font-body text-xs text-body-text">{formatRelativeShort(post.createdAt)}</span>
          </span>
        </Link>
        {mine &&
          (confirming ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="font-body text-xs text-body-text">
                Keep
              </button>
              <button type="button" onClick={onDelete} className="font-body text-xs font-bold text-danger">
                Delete
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="font-body text-xs text-body-text">
              Delete
            </button>
          ))}
      </div>
      {post.caption && <p className="whitespace-pre-line font-body text-sm leading-5 text-heading">{post.caption}</p>}
      {post.media.map((m) =>
        m.type === "VIDEO" ? (
          <video key={m.url} src={m.url} controls playsInline className="w-full rounded-xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URL, natural aspect ratio
          <img key={m.url} src={cloudinaryDisplayUrl(m.url, { width: 1080 })} alt="" className="w-full rounded-xl object-cover" />
        ),
      )}
    </article>
  );
}

// Padi Moments: the backend feed (GET /feed, POST/DELETE /feed/posts). Not
// in the Figma page — a simple timeline in the app's card style.
function MomentsContent() {
  const { accessToken, user } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    feedApi
      .listPosts(accessToken)
      .then((page) => {
        setPosts(page.items);
        setCursor(page.nextCursor);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load moments."));
  }, [accessToken]);

  async function loadMore() {
    if (!accessToken || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await feedApi.listPosts(accessToken, cursor);
      setPosts((list) => [...(list ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(postId: string) {
    if (!accessToken) return;
    const before = posts;
    setPosts((list) => list?.filter((p) => p.id !== postId) ?? null);
    try {
      await feedApi.deletePost(accessToken, postId);
    } catch (err) {
      setPosts(before);
      setError(err instanceof ApiError ? err.message : "Couldn't delete that post.");
    }
  }

  return (
    <FlowScreen largeTitle title="Padi moments" subtitle="Photos and shout-outs from padis' hangouts." backHref="/communities">
      <Composer onPosted={(p) => setPosts((list) => [p, ...(list ?? [])])} />
      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {posts === null && !error && <p className="font-body text-sm text-body-text">Loading…</p>}
      {posts?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center font-body text-[13px] text-body-text">No moments yet — share the first one!</p>
      )}
      {posts?.map((p) => (
        <PostCard key={p.id} post={p} mine={p.author.id === user?.id} onDelete={() => void remove(p.id)} />
      ))}
      {cursor && (
        <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="h-11 rounded-full border border-border font-body text-sm font-medium text-heading disabled:opacity-60">
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </FlowScreen>
  );
}

export default function MomentsPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <MomentsContent />
      </RequireCountry>
    </RequireAuth>
  );
}
