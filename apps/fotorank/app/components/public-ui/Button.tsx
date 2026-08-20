import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "fr-public-btn fr-public-btn--primary",
  secondary: "fr-public-btn fr-public-btn--secondary",
  ghost: "fr-public-btn fr-public-btn--ghost",
};

const sizeClass: Record<Size, string> = {
  md: "",
  lg: "min-h-12 px-8 py-4 text-base",
};

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  loading?: boolean;
};

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: undefined };

type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className"> & { href: string };

export type PublicButtonProps = AsButton | AsLink;

/** @public Primary / secondary actions for public + participant surfaces. */
export function PublicButton(props: PublicButtonProps) {
  const { variant = "primary", size = "md", className, children, loading, ...rest } = props;
  const classes = cn(variantClass[variant], sizeClass[size], className);

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href!} className={classes} aria-busy={loading || undefined} {...linkRest}>
        {loading ? <span className="fr-public-sr-only">Cargando</span> : null}
        {children}
      </Link>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={buttonRest.type ?? "button"}
      className={classes}
      disabled={buttonRest.disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {loading ? <span className="fr-public-sr-only">Cargando</span> : null}
      {children}
    </button>
  );
}

/** Aliases requested by the design brief. */
export const PrimaryButton = (props: PublicButtonProps) => (
  <PublicButton {...props} variant="primary" />
);
export const SecondaryButton = (props: PublicButtonProps) => (
  <PublicButton {...props} variant="secondary" />
);
