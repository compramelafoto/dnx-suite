"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIVE_CONFIG_PATH, LIVE_PATH, LIVE_RECORDINGS_PATH } from "@/lib/en-vivo/constantes";

const PESTANAS = [
  { href: LIVE_PATH, label: "Vivo", exacto: true },
  { href: LIVE_RECORDINGS_PATH, label: "Grabaciones", exacto: false },
  { href: LIVE_CONFIG_PATH, label: "Configurar", exacto: false },
] as const;

/** Pestañas de Transmisión en vivo. Mismo dibujo que las de la BOX mensual. */
export function PestanasEnVivo() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Transmisión en vivo" className="flex flex-wrap gap-2">
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
