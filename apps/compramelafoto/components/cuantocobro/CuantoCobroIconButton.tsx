"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type CuantoCobroIconButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = {
  icon: LucideIcon;
  label: string;
  title?: string;
  variant?: CuantoCobroIconButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  href?: string;
  accentColor?: string;
  className?: string;
  onClick?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick">;

export default function CuantoCobroIconButton({
  icon: Icon,
  label,
  title,
  variant = "ghost",
  disabled = false,
  loading = false,
  href,
  accentColor,
  className = "",
  onClick,
  type = "button",
  ...rest
}: Props) {
  const style =
    accentColor && (variant === "primary" || variant === "secondary")
      ? ({ "--cc-action-accent": accentColor } as CSSProperties)
      : undefined;

  const classes = [
    "cc-icon-btn",
    `cc-icon-btn--${variant}`,
    loading ? "cc-icon-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <Icon className="cc-icon-btn__icon" aria-hidden />
      {loading ? <span className="cc-icon-btn__spinner" aria-hidden /> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={classes}
        style={style}
        title={title ?? label}
        aria-label={label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      style={style}
      title={title ?? label}
      aria-label={label}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {content}
    </button>
  );
}
