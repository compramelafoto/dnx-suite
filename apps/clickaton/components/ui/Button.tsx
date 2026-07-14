import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variantClass = {
  primary:
    "border-ck-border-strong bg-ck-yellow text-ck-black hover:bg-ck-yellow-dark active:bg-[var(--ck-brand-primary-active)]",
  secondary:
    "border-ck-border-strong bg-ck-black text-ck-yellow hover:bg-ck-gray-700 active:bg-ck-black",
  outline:
    "border-ck-border-strong bg-transparent text-ck-text hover:bg-ck-black hover:text-ck-white",
  ghost: "border-transparent bg-transparent text-ck-text hover:bg-ck-gray-100",
  text: "border-transparent bg-transparent px-0 text-ck-text underline-offset-4 hover:underline",
} as const;

const sizeClass = {
  sm: "min-h-10 gap-1.5 px-3 py-2",
  md: "min-h-11 gap-2 px-5 py-2.5",
  lg: "min-h-12 gap-2 px-6 py-3",
} as const;

type CommonProps = {
  variant?: keyof typeof variantClass;
  size?: keyof typeof sizeClass;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function buttonClasses({
  variant = "primary",
  size = "md",
  loading,
  className,
  disabled,
}: {
  variant?: keyof typeof variantClass;
  size?: keyof typeof sizeClass;
  loading?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return cn(
    "ck-button-label inline-flex items-center justify-center rounded-[var(--ck-radius-control)] border-2 transition-[background-color,color,border-color,transform,box-shadow] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
    variant !== "text" && "shadow-[var(--ck-shadow-subtle)] hover:-translate-y-px active:translate-y-px",
    variantClass[variant],
    sizeClass[size],
    (disabled || loading) && "pointer-events-none opacity-55",
    className,
  );
}

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    className,
    children,
    ...rest
  } = props;

  if ("href" in props && props.href) {
    const { href, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <a
        href={href}
        className={buttonClasses({ variant, size, loading, className })}
        aria-busy={loading || undefined}
        {...linkRest}
      >
        {loading ? <span className="sr-only">Cargando</span> : null}
        {children}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={buttonRest.type ?? "button"}
      className={buttonClasses({
        variant,
        size,
        loading,
        className,
        disabled: buttonRest.disabled,
      })}
      disabled={buttonRest.disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {loading ? <span className="sr-only">Cargando</span> : null}
      {children}
    </button>
  );
}
