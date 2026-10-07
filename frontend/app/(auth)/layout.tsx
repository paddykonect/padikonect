// Mobile-first (matches Figma's 390px frames) but responsive: full-bleed on
// small viewports, centered constrained card from tablet width up — per the
// master prompt's "don't just scale the desktop design down" requirement.
// The card has a fixed height so long lists (country/state pickers) scroll
// inside it instead of stretching the page; taller pages scroll the card.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-background sm:items-center sm:bg-border/30 sm:py-10">
      <div className="flex h-dvh w-full max-w-[430px] flex-col overflow-y-auto overflow-x-hidden bg-background sm:h-[min(880px,calc(100dvh-5rem))] sm:rounded-3xl sm:shadow-xl">
        {children}
      </div>
    </div>
  );
}
