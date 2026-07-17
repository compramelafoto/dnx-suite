"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNavIcon } from "@/components/admin/AdminNavIcon";
import { Wordmark } from "@/components/brand/Wordmark";
import {
  adminNavigation,
  adminRoutes,
  isAdminNavActive,
} from "@/config/admin/navigation";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  onNavigate?: () => void;
};

export function AdminSidebar({ className, onNavigate }: Props) {
  const pathname = usePathname();
  const main = adminNavigation.filter((item) => item.section === "main");
  const system = adminNavigation.filter((item) => item.section === "system");

  return (
    <aside
      className={cn(
        "flex h-full w-72 flex-col border-r border-ck-border bg-ck-surface-muted",
        className,
      )}
    >
      <div className="border-b border-ck-border px-5 py-5">
        <Wordmark
          href={adminRoutes.dashboard}
          tone="inverse"
          height={40}
          className="h-9 w-auto max-w-[11rem]"
        />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-ck-text-muted">
          Panel operativo
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Administración">
        <NavGroup items={main} pathname={pathname} onNavigate={onNavigate} />
        <div>
          <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ck-text-muted">
            Sistema
          </p>
          <NavGroup items={system} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </nav>

      <div className="border-t border-ck-border px-5 py-4">
        <Link
          href="/"
          className="text-sm text-ck-text-secondary transition-colors hover:text-ck-yellow"
          onClick={onNavigate}
        >
          Ver sitio público
        </Link>
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof adminNavigation;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isAdminNavActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[var(--ck-radius-control)] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-ck-yellow text-[var(--ck-text-on-brand)]"
                  : "text-ck-text-secondary hover:bg-ck-surface-strong hover:text-ck-text",
              )}
            >
              <AdminNavIcon name={item.icon} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
