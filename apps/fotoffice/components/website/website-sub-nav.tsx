"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** Menú SECUNDARIO — Historial/SEO/Navegación no compiten en protagonismo con el constructor
 * (Plantillas/Secciones/Diseño, dentro de `/website`). Se accede desde acá o desde el link
 * "Volver al constructor" en cada una de estas pantallas. */
const SECONDARY_TABS = [
  { href: "/website/navegacion", label: "Navegación" },
  { href: "/website/seo", label: "SEO" },
  { href: "/website/historial", label: "Historial" },
] as const;

export function WebsiteSubNav() {
  const pathname = usePathname();
  const inBuilder = pathname === "/website";

  if (inBuilder) return null;

  return (
    <div className="flex items-center justify-between border-b border-[var(--fo-border)]">
      <Link href="/website" className="flex items-center gap-1 py-2.5 text-sm font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
        <ChevronLeft className="h-4 w-4" /> Volver al constructor
      </Link>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Configuración del sitio">
        {SECONDARY_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active ? "border-[var(--fo-accent)] text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
