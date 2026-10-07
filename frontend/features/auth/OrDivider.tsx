export function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="font-body text-xs text-body-text">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
