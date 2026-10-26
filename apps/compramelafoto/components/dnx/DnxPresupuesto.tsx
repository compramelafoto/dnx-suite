"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef, type ReactNode } from "react";

import type { DnxPagina, DnxPaleta } from "@/components/dnx/DnxCta";

/**
 * "Pedí tu presupuesto": el formulario de consulta de FOTOFFICE (DNX Estudio) insertado en la
 * landing. La consulta entra a FOTOFFICE con su categoría (XV o boda) y desde ahí sale el
 * presupuesto con la propuesta modelo de esa categoría: por eso las landings ya no muestran
 * importes. El formulario avisa su alto ({ type: "fotoffice-form-height", height }) y acá se
 * ajusta el marco; sólo se obedece al marco propio y al origen de FOTOFFICE.
 */
export const FOTOFFICE_ORIGEN = "https://fotoffice.com";
const DNX_SLUG = "dnx-estudio";
export const PRESUPUESTO_SECTION_ID = "pedir-presupuesto";

export type DnxFormulario = "xv" | "boda";

export function urlFormularioDnx(formulario: DnxFormulario): string {
  return `${FOTOFFICE_ORIGEN}/w/${DNX_SLUG}/insertar/${formulario}`;
}

const MENSAJE_ALTO = "fotoffice-form-height";
const ALTO_INICIAL = 760;
const ALTO_MAXIMO = 4000;

const BOTON: Record<DnxPaleta, Record<"primary" | "secondary", string>> = {
  xv: {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
  },
  bodas: {
    primary: "bg-stone-900 text-white hover:bg-stone-800",
    secondary: "bg-white text-stone-900 border border-stone-200 hover:bg-stone-50",
  },
};

/** Botón que lleva al formulario de la misma página. */
export function DnxCtaPresupuesto({
  pagina,
  paleta,
  variant = "primary",
  className = "",
  children = "Pedí tu presupuesto",
}: {
  pagina: DnxPagina;
  paleta: DnxPaleta;
  variant?: "primary" | "secondary";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={`#${PRESUPUESTO_SECTION_ID}`}
      onClick={() => track("dnx_cta_presupuesto", { pagina })}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${BOTON[paleta][variant]} ${className}`}
    >
      {children}
    </a>
  );
}

/** El marco con el formulario de FOTOFFICE. */
export function DnxFormularioPresupuesto({ formulario, titulo }: { formulario: DnxFormulario; titulo: string }) {
  const marco = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const alRecibir = (event: MessageEvent) => {
      const datos = event.data as { type?: unknown; height?: unknown } | null;
      if (!datos || typeof datos !== "object" || datos.type !== MENSAJE_ALTO) return;
      const nodo = marco.current;
      if (!nodo || event.source !== nodo.contentWindow || event.origin !== FOTOFFICE_ORIGEN) return;
      const alto = Number(datos.height);
      if (!Number.isFinite(alto) || alto <= 0) return;
      nodo.style.height = `${Math.max(200, Math.min(Math.ceil(alto), ALTO_MAXIMO))}px`;
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, []);

  return (
    <iframe
      ref={marco}
      src={urlFormularioDnx(formulario)}
      title={titulo}
      loading="lazy"
      className="w-full border-0"
      style={{ height: ALTO_INICIAL }}
    />
  );
}
