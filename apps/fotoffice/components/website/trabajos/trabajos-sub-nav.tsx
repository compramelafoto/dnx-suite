"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TRABAJOS_ADMIN_BASE } from "@/lib/trabajos/reglas";

const SECCIONES = [
  { key: "trabajos", label: "Trabajos", href: TRABAJOS_ADMIN_BASE },
  { key: "categorias", label: "Categorías", href: `${TRABAJOS_ADMIN_BASE}/categorias` },
] as const;

/** Pestañas de Trabajos, con el mismo dibujo que las del blog. La lista y la ficha de un trabajo
 * son «Trabajos»; las categorías tienen su pestaña. */
export function TrabajosSubNav() {
  const pathname = usePathname() ?? "";
  const activa = pathname.startsWith(`${TRABAJOS_ADMIN_BASE}/categorias`) ? "categorias" : "trabajos";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-[var(--fo-border)]">
      <Link
        href="/website"
        className="flex items-center gap-1 py-2.5 text-sm font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
      >
        <ChevronLeft className="h-4 w-4" /> Sitio web
      </Link>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones de Trabajos">
        {SECCIONES.map((s) => {
          const active = s.key === activa;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={[
                "px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
                  : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
