import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function WelcomePage() {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-background sm:items-center sm:bg-border/30 sm:py-10">
      <div className="flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-background sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
        <div className="relative h-[45vh] min-h-[360px] w-full shrink-0 overflow-hidden sm:h-[420px]">
          <Image
            src="/images/welcome-hero.jpg"
            alt="Padis toasting drinks together at a hangout"
            fill
            priority
            sizes="430px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 from-[74%] to-black" />
          <div className="absolute bottom-6 right-5 flex flex-col items-end gap-2">
            <div className="flex items-center">
              {["/images/avatar-1.png", "/images/avatar-2.png", "/images/avatar-3.jpg"].map((src, i) => (
                <span key={src} className={`relative size-10 overflow-hidden rounded-full border-2 border-black/20 bg-border ${i > 0 ? "-ml-[5px]" : ""}`}>
                  <Image src={src} alt="" fill sizes="40px" className="object-cover" />
                </span>
              ))}
            </div>
            <p className="text-xs tracking-[0.024em] text-white">150+ People Joined</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-5 py-7">
          <h1 className="font-heading text-[30px] font-bold leading-[38px] tracking-[-0.15px] text-heading">Paddykonect</h1>
          <p className="font-body text-[15px] leading-[22px] text-body-text">
            {`Turn "let's grab a drink" into an actual plan. Discover hangouts, connect with new padis, and build your circle — alcoholic and non-alcoholic alike.`}
          </p>
          <div className="flex-1" />
          <Link href="/signup" className="w-full">
            <Button variant="primary">Get started</Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button variant="text">I have an account</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
