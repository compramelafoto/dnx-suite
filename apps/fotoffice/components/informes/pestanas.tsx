"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/informes", label: "Tablero", exacto: true },
  { href: "/informes/resultados", label: "Resultados", exacto: false },
  { href: "/informes/ventas", label: "Ventas", exacto: false },
  { href: "/informes/flujo", label: "Flujo de caja", exacto: false },
  { href: "/informes/monotributo", label: "Monotributo", exacto: false },
] as const;

/** Pestañas de Informes. "Ajustes" sólo se dibuja para quien puede configurar (lo decide el servidor). */
export function PestanasInformes({ conAjustes }: { conAjustes: boolean }) {
  const path = usePathname() ?? "";
  const items = conAjustes ? [...PESTANAS, { href: "/informes/ajustes", label: "Ajustes", exacto: false }] : PESTANAS;
  return (
    <nav aria-label="Informes" className="flex flex-wrap gap-2">
      {items.map((p) => {
        const activa = p.exacto ? path === p.href : path === p.href || path.startsWith(`${p.href}/`);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`fo-btn min-h-9 text-sm ${activa ? "fo-btn-primary" : "fo-btn-ghost"}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
