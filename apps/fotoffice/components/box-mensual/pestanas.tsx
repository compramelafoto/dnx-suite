"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/members/box", label: "Para enviar", exacto: true },
  { href: "/members/box/preparar", label: "Preparar", exacto: false },
  { href: "/members/box/enviadas", label: "Enviadas", exacto: false },
  { href: "/members/box/cajas", label: "Cajas", exacto: false },
] as const;

/** Pestañas de la BOX mensual. Mismo dibujo que las de Informes. */
export function PestanasBox() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="BOX mensual" className="flex flex-wrap gap-2">
      {PESTANAS.map((p) => {
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
