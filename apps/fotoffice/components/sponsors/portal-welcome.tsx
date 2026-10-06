"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import type { PlacedSponsor } from "@/lib/sponsors/placements";
import { SponsorLogo } from "./sponsor-logo";

/**
 * La ventana que ve el socio al entrar al portal, con el sponsor del espacio de bienvenida.
 *
 * Una vez por visita: se recuerda en `sessionStorage`, por sponsor, así cerrar la ventana no la
 * vuelve a abrir en cada pantalla del portal, y un sponsor nuevo sí se ve aunque ya se haya
 * cerrado el anterior. Si el navegador no deja guardar, se muestra igual y se cierra igual.
 */
/** No hay nada que escuchar: `sessionStorage` sólo cambia cuando este mismo componente cierra. */
function sinSuscripcion() {
  return () => {};
}

function yaSeVio(clave: string): boolean {
  try {
    return sessionStorage.getItem(clave) !== null;
  } catch {
    return false; // Sin almacenamiento: se muestra.
  }
}

export function PortalSponsorWelcome({ sponsor }: { sponsor: PlacedSponsor }) {
  const clave = `fo-sponsor-welcome:${sponsor.partnerId}`;
  // En el servidor cuenta como vista: la ventana aparece recién en el navegador, sin saltos.
  const vista = useSyncExternalStore(sinSuscripcion, () => yaSeVio(clave), () => true);
  const [cerrada, setCerrada] = useState(false);
  const abierta = !vista && !cerrada;

  const cerrar = useCallback(() => {
    try {
      sessionStorage.setItem(clave, "1");
    } catch {
      // Nada que hacer: se cierra igual.
    }
    setCerrada(true);
  }, [clave]);

  useEffect(() => {
    if (!abierta) return;
    const alEscapar = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", alEscapar);
    return () => window.removeEventListener("keydown", alEscapar);
  }, [abierta, cerrar]);

  if (!abierta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={cerrar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fo-sponsor-welcome-title"
        className="fo-card relative w-full max-w-sm space-y-4 p-6 text-center shadow-[var(--fo-shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="fo-icon-btn absolute top-3 right-3">
          <X className="size-4" aria-hidden />
        </button>
        <div className="flex justify-center">
          <SponsorLogo name={sponsor.name} src={sponsor.logoSrc} className="size-28" />
        </div>
        <div className="space-y-2">
          <p id="fo-sponsor-welcome-title" className="text-lg font-semibold">
            {sponsor.title || sponsor.name}
          </p>
          {sponsor.description ? (
            <p className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">{sponsor.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {sponsor.href ? (
            <a
              href={sponsor.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={cerrar}
              className="fo-btn fo-btn-primary text-sm"
            >
              Conocer más
            </a>
          ) : null}
          <button type="button" onClick={cerrar} className="fo-btn fo-btn-ghost text-sm">
            Seguir al portal
          </button>
        </div>
      </div>
    </div>
  );
}
