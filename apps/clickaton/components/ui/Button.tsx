import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const variantClass = {
  primary:
    "border-[var(--ck-core-ink-on-brand)] bg-ck-yellow text-[var(--ck-text-on-brand)] shadow-[var(--ck-shadow-subtle)] hover:bg-ck-yellow-dark hover:shadow-[var(--ck-shadow-glow)] hover:-translate-y-0.5 active:translate-y-px active:bg-[var(--ck-brand-primary-active)]",
  secondary:
    "border-ck-yellow bg-transparent text-ck-yellow hover:bg-ck-yellow hover:text-[var(--ck-text-on-brand)] hover:-translate-y-0.5 active:translate-y-px",
  outline:
    "border-ck-border-strong bg-transparent text-ck-text hover:border-ck-yellow hover:text-ck-yellow",
  ghost:
    "border-transparent bg-transparent text-ck-text-secondary hover:bg-ck-surface-strong hover:text-ck-text",
  text: "border-transparent bg-transparent px-0 text-ck-yellow underline-offset-4 hover:underline",
} as const;

const sizeClass = {
  sm: "min-h-10 gap-1.5 px-3.5 py-2",
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
    "ck-button-label inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--ck-radius-control)] border-2 transition-[background-color,color,border-color,transform,box-shadow,filter] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
    variantClass[variant],
    sizeClass[size],
    (disabled || loading) && "pointer-events-none opacity-[var(--ck-opacity-muted)]",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = "primary",
      size = "md",
      loading = false,
      className,
      children,
      ...rest
    } = props;

    if ("href" in props && typeof props.href === "string" && props.href.length > 0) {
      const { href, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
        href?: string;
      };
      const resolvedHref = props.href;
      return (
        <Link
          ref={ref as Ref<HTMLAnchorElement>}
          href={resolvedHref}
          className={buttonClasses({ variant, size, loading, className })}
          aria-busy={loading || undefined}
          {...linkRest}
        >
          {loading ? <span className="sr-only">Cargando</span> : null}
          {children}
        </Link>
      );
    }

    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
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
  },
);
