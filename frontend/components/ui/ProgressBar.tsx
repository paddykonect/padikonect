interface ProgressBarProps {
  /** 0-100 */
  percent: number;
}

// Matches Figma's post-signup setup progress bar (Taste Picker, Location).
export function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="w-full pt-4">
      <div className="h-1 w-full overflow-hidden rounded-pill bg-border">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}
