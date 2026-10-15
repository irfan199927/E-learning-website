import { forwardRef, type ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
  ghost: "bg-transparent text-primary hover:bg-primary-soft",
  live: "bg-live text-white hover:brightness-95",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/** 44px minimum touch target (WCAG 2.5.5). Disabled state keeps readable contrast. */
export function buttonClasses(variant: ButtonVariant = "primary", extra = ""): string {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-[15px] font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:bg-[#ECEEF2] disabled:text-[#4B5162] disabled:border-transparent",
    VARIANTS[variant],
    extra,
  ].join(" ");
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ variant = "primary", className = "", type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClasses(variant, className)} {...props} />;
});
