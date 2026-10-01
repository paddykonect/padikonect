"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { error, className = "", ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="w-full">
      <div className={`flex h-[46px] w-full items-center gap-3 overflow-hidden rounded-field border bg-white px-4 ${error ? "border-danger" : "border-border"}`}>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`min-w-0 flex-1 bg-transparent font-body text-[15px] leading-[22px] text-input-text placeholder:text-body-text outline-none ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="shrink-0 text-body-text"
        >
          {visible ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.5A9.9 9.9 0 0112 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.6 6.6C4.6 8 3.2 9.9 2 12c1 3 5 7 10 7 1.3 0 2.6-.3 3.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
