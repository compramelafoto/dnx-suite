import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type HeaderSecondaryLinkProps = {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  /** Número opcional (ej. invitaciones enviadas). */
  badgeCount?: number;
  "aria-label"?: string;
};

/**
 * Acción secundaria en cabecera de vista: borde sutil, hover dorado, icono opcional.
 */
export function HeaderSecondaryLink({ href, children, icon: Icon, badgeCount, ...rest }: HeaderSecondaryLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-fr-border bg-fr-bg-elevated px-4 py-2.5 text-sm font-medium text-fr-primary shadow-sm transition-colors hover:border-gold/35 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/50 active:opacity-90"
      {...rest}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-gold/85" aria-hidden /> : null}
      <span>{children}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className="rounded-full bg-gold/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-gold">{badgeCount}</span>
      ) : null}
    </Link>
  );
}
