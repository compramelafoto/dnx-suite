"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef, type ReactNode } from "react";

/** Identifica cuál de las cuatro variantes se está mirando. */
export type DnxPagina = "xv" | "xv-sp" | "bodas" | "bodas-sp";

/** XV usa la escala zinc; bodas usa la escala stone. */
export type DnxPaleta = "xv" | "bodas";

type Variante = "primary" | "secondary" | "ghost";

const ESTILOS: Record<DnxPaleta, Record<Variante, string>> = {
  xv: {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
    ghost: "text-zinc-700 hover:text-zinc-900 underline underline-offset-4",
  },
  bodas: {
    primary: "bg-stone-900 text-white hover:bg-stone-800",
    secondary: "bg-white text-stone-900 border border-stone-200 hover:bg-stone-50",
    ghost: "text-stone-700 hover:text-stone-900 underline underline-offset-4",
  },
};

const BASE =
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition";

export function DnxCtaEntrevista({
  href,
  pagina,
  paleta,
  modo,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  pagina: DnxPagina;
  paleta: DnxPaleta;
  modo: "presencial" | "online";
  variant?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("dnx_cta_entrevista", { pagina, modo })}
      className={`${BASE} ${ESTILOS[paleta][variant]} ${className}`}
    >
      {children}
    </a>
  );
}

export function DnxCtaWhatsapp({
  href,
  pagina,
  paleta,
  variant = "ghost",
  className = "",
  children,
}: {
  href: string;
  pagina: DnxPagina;
  paleta: DnxPaleta;
  variant?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("dnx_cta_whatsapp", { pagina })}
      className={`${BASE} ${ESTILOS[paleta][variant]} ${className}`}
    >
      {children}
    </a>
  );
}

/** Enlaces de apoyo: reseñas de Google, videos, Instagram. */
export function DnxEnlaceExterno({
  href,
  pagina,
  paleta,
  destino,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  pagina: DnxPagina;
  paleta: DnxPaleta;
  destino: string;
  variant?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("dnx_enlace_externo", { pagina, destino })}
      className={`${BASE} ${ESTILOS[paleta][variant]} ${className}`}
    >
      {children}
    </a>
  );
}

/**
 * Marca invisible que avisa cuando el bloque de precios entró en pantalla.
 * Sirve para saber cuánta gente llega efectivamente a ver los importes.
 */
export function DnxPreciosVistos({ pagina }: { pagina: DnxPagina }) {
  const referencia = useRef<HTMLDivElement>(null);
  const yaAvisado = useRef(false);

  useEffect(() => {
    const nodo = referencia.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting || yaAvisado.current) continue;
          yaAvisado.current = true;
          track("dnx_precios_vistos", { pagina });
          observador.disconnect();
        }
      },
      // Umbral 0: alcanza con que la marca asome. Un umbral fraccionario
      // sobre un elemento de 1px de alto queda a merced del redondeo
      // subpíxel y puede no dispararse nunca.
      { threshold: 0 },
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, [pagina]);

  return <div ref={referencia} aria-hidden className="h-px w-full" />;
}
