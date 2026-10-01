import { InputHTMLAttributes, forwardRef } from "react";

interface PhoneFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

// Nigeria-only for MVP (matches the backend's `^\+234\d{10}$` validation) —
// a fixed +234 prefix, not a country selector, per the PRD's literal
// "+234 phone number" field.
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  { error, className = "", ...props },
  ref,
) {
  return (
    <div className="w-full">
      <div className={`flex h-[46px] w-full items-stretch overflow-hidden rounded-field border bg-white ${error ? "border-danger" : "border-border-subtle"}`}>
        <div className="flex shrink-0 items-center border-r border-border-subtle px-4">
          <span className="font-body text-sm text-body-text">+234</span>
        </div>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          className={`min-w-0 flex-1 bg-transparent px-3.5 font-body text-sm text-input-text placeholder:text-body-text outline-none ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
