import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
}

// Matches Figma "Input / Text" and "Input / Email" — same field shell,
// optional trailing icon (see plan: don't build a separate component per
// visually-identical field).
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { icon, error, className = "", ...props },
  ref,
) {
  return (
    <div className="w-full">
      <div
        className={`flex h-[46px] w-full items-center gap-3 overflow-hidden rounded-field border bg-white px-4 ${
          error ? "border-danger" : "border-border"
        }`}
      >
        <input
          ref={ref}
          className={`min-w-0 flex-1 bg-transparent font-body text-[15px] leading-[22px] text-input-text placeholder:text-body-text outline-none ${className}`}
          {...props}
        />
        {icon}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
