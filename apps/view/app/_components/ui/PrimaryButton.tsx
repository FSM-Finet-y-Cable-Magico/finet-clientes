import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "solid" | "outline" | "conversion";

type Props = {
  children: React.ReactNode;
  href?: string;
  variant?: Variant;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

const variantClasses: Record<Variant, string> = {
  solid: "bg-primary text-background hover:opacity-90",
  outline:
    "border border-primary text-primary hover:bg-primary hover:text-background",
  // Conversion CTA — Finet Lime + Deep Slate text, reserved for "Contratar / Pagar / Checkout" (DESIGN.md)
  conversion:
    "bg-accent text-on-accent font-semibold shadow-sm hover:shadow-md hover:brightness-105 focus-visible:outline-accent",
};

export default function PrimaryButton({
  children,
  href,
  variant = "solid",
  type,
  disabled,
  className = "",
  onClick,
}: Props) {
  const sharedClasses = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${variantClasses[variant]} ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={sharedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={sharedClasses}
    >
      {children}
    </button>
  );
}
