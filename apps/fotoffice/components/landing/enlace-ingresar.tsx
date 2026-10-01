"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * El acceso al panel.
 *
 * Mantiene el atajo que ya existía en la portada anterior: Mayús + clic abre el login en
 * variante administración de plataforma (`/login?admin=1`). No se anuncia en pantalla — quien
 * lo necesita ya lo sabe— pero no se puede perder, porque es la única puerta a esa variante.
 */
export function EnlaceIngresar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href="/login"
      className={className}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault();
          window.location.assign("/login?admin=1");
        }
      }}
    >
      {children}
    </Link>
  );
}
