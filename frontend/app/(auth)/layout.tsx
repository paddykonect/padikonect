// Mobile-first (matches Figma's 390px frames) but responsive: full-bleed on
// small viewports, centered constrained card from tablet width up — per the
// master prompt's "don't just scale the desktop design down" requirement.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-background sm:items-center sm:bg-border/30 sm:py-10">
      <div className="flex min-h-dvh w-full max-w-[430px] flex-col bg-background sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
        {children}
      </div>
    </div>
  );
}
