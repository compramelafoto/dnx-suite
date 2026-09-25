"use client";

import Link from "next/link";
import type { RolDisponible, Rol } from "./menuDeLaCuenta";

/**
 * El selector de rol, arriba de la barra lateral.
 *
 * Cada botón lleva al inicio de su rol; el rol activo sale de la pantalla en la
 * que está la persona, así que no hay estado que se pueda desfasar. Con un solo
 * rol no se muestra: no hay nada que elegir.
 */
export function SelectorDeRol({
  roles,
  activo,
  onNavigate,
}: {
  roles: RolDisponible[];
  activo: Rol | null;
  onNavigate?: () => void;
}) {
  if (roles.length < 2) return null;

  return (
    <nav aria-label="Rol" className="border-b border-fr-border px-4 pb-4 pt-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-fr-muted-soft">
        Rol
      </p>
      <div className="flex gap-1 rounded-xl border border-fr-border bg-fr-bg p-1">
        {roles.map((r) => {
          const esActivo = r.rol === activo;
          return (
            <Link
              key={r.rol}
              href={r.inicio}
              onClick={onNavigate}
              aria-current={esActivo ? "page" : undefined}
              className={
                "flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors " +
                (esActivo
                  ? "bg-gold text-black"
                  : "text-fr-muted hover:bg-fr-card hover:text-fr-primary")
              }
            >
              {r.etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** El rótulo fijo del super admin, en el mismo lugar que el selector. */
export function RotuloSuperAdmin() {
  return (
    <div className="border-b border-fr-border px-4 pb-4 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fr-muted-soft">Rol</p>
      <p className="mt-1 text-sm font-semibold text-gold">Super administrador</p>
    </div>
  );
}
