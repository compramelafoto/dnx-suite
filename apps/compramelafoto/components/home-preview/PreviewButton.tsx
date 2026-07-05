import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PreviewButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type PreviewButtonSize = "sm" | "md" | "lg";

const sizeClass: Record<PreviewButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-[0.9375rem] rounded-xl gap-2",
};

const variantClass: Record<PreviewButtonVariant, string> = {
  primary:
    "bg-[#111827] text-white hover:bg-[#1f2937] active:bg-[#0f172a] border border-transparent shadow-none",
  secondary:
    "bg-white text-[#374151] border border-[#e5e7eb] hover:bg-[#f9fafb] hover:border-[#d1d5db] shadow-none",
  ghost: "bg-transparent text-[#4b5563] hover:bg-[#f3f4f6] border border-transparent shadow-none",
  accent:
    "bg-[#c27b3d] text-white hover:bg-[#b06d35] active:bg-[#9a5f2f] border border-transparent shadow-none",
};

const baseClass =
  "inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/15 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-full sm:w-auto";

type ButtonClassOptions = {
  variant?: PreviewButtonVariant;
  size?: PreviewButtonSize;
  className?: string;
  block?: boolean;
};

type SharedProps = ButtonClassOptions & {
  children: ReactNode;
};

function buttonClasses({
  variant = "primary",
  size = "md",
  className,
  block,
}: ButtonClassOptions) {
  return cn(baseClass, sizeClass[size], variantClass[variant], block && "w-full", className);
}

export function PreviewButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: SharedProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button type="button" className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function PreviewButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: SharedProps & Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** CTA terciario: link con flecha discreta */
export function PreviewTextLink({
  href,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-[#6b7280] hover:text-[#111827] transition-colors",
        className
      )}
      {...props}
    >
      {children}
      <span aria-hidden className="text-[#9ca3af]">
        →
      </span>
    </Link>
  );
}
