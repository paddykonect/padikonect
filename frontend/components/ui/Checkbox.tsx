import { InputHTMLAttributes, forwardRef } from "react";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={`size-4 shrink-0 rounded border border-body-text bg-card accent-heading ${className}`}
        {...props}
      />
    );
  },
);
