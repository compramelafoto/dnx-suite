"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/website", label: "Editor" },
  { href: "/website/diseno", label: "Diseño" },
  { href: "/website/navegacion", label: "Navegación" },
  { href: "/website/seo", label: "SEO" },
  { href: "/website/historial", label: "Historial" },
] as const;

export function WebsiteSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-[var(--fo-border)] overflow-x-auto" aria-label="Secciones del sitio web">
      {TABS.map((tab) => {
        const active = tab.href === "/website" ? pathname === "/website" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              active
                ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
                : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
