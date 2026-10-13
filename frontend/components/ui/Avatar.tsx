import Image from "next/image";
import { cloudinaryDisplayUrl } from "@/lib/media/cloudinary";

interface AvatarProps {
  name: string;
  photoUrl: string | null;
  size: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// Figma "Avatar" (node 14:32): image content, falling back to initials.
export function Avatar({ name, photoUrl, size, className = "" }: AvatarProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#dde7f5] ${className}`}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // f_auto converts HEIC phone uploads to a browser-friendly format;
        // without it iPhone avatars render blank. 2x width for retina crispness.
        <Image src={cloudinaryDisplayUrl(photoUrl, { width: size * 2 })} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        <span className="font-body font-bold text-[#1b3b2b]" style={{ fontSize: Math.max(8, size * 0.36) }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
