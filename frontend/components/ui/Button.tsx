import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "text";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const base = "w-full rounded-pill px-5 py-4 text-sm font-body text-center transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground font-bold",
  text: "bg-transparent text-heading font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, disabled, children, className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
});
