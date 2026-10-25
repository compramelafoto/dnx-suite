"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/equipo", label: "Jornadas", exacto: false },
  { href: "/equipo/mensajes", label: "Mensajes", exacto: false },
  { href: "/equipo/configuracion", label: "Configuración", exacto: false },
] as const;

/** Pestañas del panel Equipo. "Jornadas" queda marcada también dentro de cada ficha. */
export function PestanasEquipo() {
  const path = usePathname() ?? "";
  const activa = (href: string) =>
    href === "/equipo"
      ? path === "/equipo" || (path.startsWith("/equipo/") && !path.startsWith("/equipo/mensajes") && !path.startsWith("/equipo/configuracion"))
      : path === href || path.startsWith(`${href}/`);
  return (
    <nav aria-label="Equipo" className="flex flex-wrap gap-2">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={activa(p.href) ? "page" : undefined}
          className={`fo-btn min-h-9 text-sm ${activa(p.href) ? "fo-btn-primary" : "fo-btn-ghost"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
