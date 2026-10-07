import Image from "next/image";

const GOAL = 10;

// Figma node 590:8987 (Padi Rewards). Progress counts hangouts hosted.
export function RewardsCard({ hostedCount }: { hostedCount: number }) {
  const done = Math.min(hostedCount, GOAL);
  const remaining = GOAL - done;
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-accent/25 p-4">
      <Image src="/images/gift-box.png" alt="" width={38} height={38} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p className="flex gap-[5px] font-body text-xs leading-4">
          <span className="text-body-text">Padi Rewards</span>
          <span className="font-bold text-heading">
            {done} / {GOAL} hangouts
          </span>
        </p>
        <p className="font-body text-[10px] text-heading">
          {remaining > 0
            ? `Host ${remaining} more to unlock a free round at any registered lounge →`
            : "You've unlocked a free round at any registered lounge! 🎉"}
        </p>
      </div>
    </div>
  );
}
