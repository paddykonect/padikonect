import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation } from "./types";

// Event chats show the hangout cover (Figma's 48px rounded square), community
// chats their emoji, direct chats the other padi's avatar.
export function ChatImage({ chat, size = 48 }: { chat: Conversation; size?: number }) {
  if (chat.type === "DIRECT") {
    return <Avatar name={chat.title} photoUrl={chat.imageUrl} size={size} />;
  }
  return (
    <span style={{ width: size, height: size }} className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/35 text-xl">
      {chat.imageUrl ? (
        <Image src={chat.imageUrl} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        (chat.emoji ?? "🎉")
      )}
    </span>
  );
}
