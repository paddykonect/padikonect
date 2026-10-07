export type HomeView = "hangouts" | "padis";

// Figma "toggle" (node 590:8996).
export function ViewToggle({ value, onChange }: { value: HomeView; onChange: (v: HomeView) => void }) {
  const options: Array<{ id: HomeView; label: string }> = [
    { id: "hangouts", label: "Hangouts" },
    { id: "padis", label: "Padis" },
  ];
  return (
    <div role="tablist" className="flex w-full rounded-full border border-border bg-toggle-bg p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex h-9 flex-1 items-center justify-center rounded-full px-1.5 font-body text-[13px] font-bold leading-[18px] ${
            value === o.id ? "bg-ink text-white shadow-[0px_1px_1.5px_rgba(0,0,0,0.15)]" : "text-body-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
