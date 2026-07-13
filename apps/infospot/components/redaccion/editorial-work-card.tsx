import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  meta?: string;
  /** Una sola acción primaria opcional. */
  primaryAction?: { label: string; href: string };
  children?: ReactNode;
  className?: string;
};

/**
 * Card unificada del Centro Editorial (evento, material, borrador, etc.).
 * Una jerarquía visual compartida; una acción primaria como máximo.
 */
export function EditorialWorkCard({
  eyebrow,
  title,
  description,
  href,
  meta,
  primaryAction,
  children,
  className = "",
}: Props) {
  const body = (
    <>
      {eyebrow ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-2 font-[family-name:var(--font-source-serif)] text-lg font-semibold tracking-tight text-[var(--is-text)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)] line-clamp-3">
          {description}
        </p>
      ) : null}
      {meta ? <p className="mt-3 text-xs text-[var(--is-muted)]">{meta}</p> : null}
      {children}
      {primaryAction ? (
        <span className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--is-accent)]">
          {primaryAction.label} →
        </span>
      ) : null}
    </>
  );

  const shellClass = [
    "block rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-5 transition-colors",
    href ? "hover:border-[var(--is-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)]" : "",
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {body}
      </Link>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
