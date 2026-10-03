"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/workspace/configuracion/comision";

const TABS = [
  { href: BASE, label: "Integrantes", match: (p: string) => p === BASE },
  { href: `${BASE}/cargos`, label: "Cargos", match: (p: string) => p.startsWith(`${BASE}/cargos`) },
  { href: `${BASE}/roles`, label: "Roles", match: (p: string) => p.startsWith(`${BASE}/roles`) },
];

/** Pestañas de la comisión, con el mismo dibujo que las del blog (`BlogSubNav`). */
export function ComisionTabs() {
  const path = (usePathname() ?? "").replace(/\/$/, "");
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-[var(--fo-border)]"
      aria-label="Secciones de la Comisión directiva"
    >
      {TABS.map((t) => {
        const active = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
                : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
