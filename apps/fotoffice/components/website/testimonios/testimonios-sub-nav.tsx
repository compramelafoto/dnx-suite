"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RUTA_PANEL_TESTIMONIOS } from "@/lib/testimonios/rutas";
import { InsigniaPendientes } from "./insignia-pendientes";

const SECCIONES = [
  { key: "testimonios", label: "Testimonios", href: RUTA_PANEL_TESTIMONIOS },
  { key: "ajustes", label: "Ajustes", href: `${RUTA_PANEL_TESTIMONIOS}/ajustes` },
] as const;

/** Pestañas de Testimonios, con el mismo dibujo que las de Trabajos y el blog. */
export function TestimoniosSubNav({ pendientes }: { pendientes: number }) {
  const pathname = usePathname() ?? "";
  const activa = pathname.startsWith(`${RUTA_PANEL_TESTIMONIOS}/ajustes`) ? "ajustes" : "testimonios";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-[var(--fo-border)]">
      <Link
        href="/website"
        className="flex items-center gap-1 py-2.5 text-sm font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
      >
        <ChevronLeft className="h-4 w-4" /> Sitio web
      </Link>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones de Testimonios">
        {SECCIONES.map((s) => {
          const active = s.key === activa;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
                  : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              {s.label}
              {s.key === "testimonios" ? <InsigniaPendientes cantidad={pendientes} /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
