import { InputHTMLAttributes, forwardRef } from "react";

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

// Same shell as TextField, wrapping a native date picker. Native date inputs
// ignore `placeholder`, so it's drawn as an overlay while the value is empty.
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { error, placeholder, value, className = "", ...props },
  ref,
) {
  const empty = !value;
  return (
    <div className="w-full">
      <div
        className={`relative flex h-[46px] w-full items-center gap-3 overflow-hidden rounded-field border bg-card px-4 ${
          error ? "border-danger" : "border-border"
        }`}
      >
        <input
          ref={ref}
          type="date"
          value={value}
          aria-label={placeholder}
          className={`peer min-w-0 flex-1 appearance-none bg-transparent font-body text-[15px] leading-[22px] outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 ${
            empty ? "text-transparent focus:text-input-text" : "text-input-text"
          } ${className}`}
          {...props}
        />
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-4 font-body text-[15px] leading-[22px] text-body-text peer-focus:hidden">
            {placeholder}
          </span>
        )}
        <CalendarIcon />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="pointer-events-none absolute right-4 shrink-0 text-body-text">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
