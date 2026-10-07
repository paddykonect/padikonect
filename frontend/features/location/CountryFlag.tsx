import Image from "next/image";
import { flagUrl } from "./countries";

// Circular flag with the light ring from Figma's country picker rows.
export function CountryFlag({ code, size = 32 }: { code: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-full border-2 border-border bg-border"
      style={{ width: size, height: size }}
    >
      <Image src={flagUrl(code)} alt="" width={size} height={size} className="size-full object-cover" />
    </span>
  );
}
