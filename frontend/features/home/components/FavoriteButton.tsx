import Image from "next/image";

// Figma component "Button - Favourite" (405:2760 / 405:2763).
export function FavoriteButton({ favorite, onToggle, label }: { favorite: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      className={`flex size-7 items-center justify-center rounded-full ${favorite ? "bg-accent" : "bg-white/85"}`}
    >
      <Image src={favorite ? "/icons/home/heart-filled.svg" : "/icons/home/heart-outline.svg"} alt="" width={13} height={13} />
    </button>
  );
}
