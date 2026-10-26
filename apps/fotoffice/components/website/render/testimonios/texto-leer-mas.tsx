"use client";

import { useState } from "react";
import { LARGO_LEER_MAS } from "@/lib/testimonios/dominio";

/** El comienzo del texto, cortado en el último espacio antes del límite (no a mitad de palabra). */
export function comienzoDelTexto(texto: string, largo = LARGO_LEER_MAS): string {
  if (texto.length <= largo) return texto;
  const corte = texto.slice(0, largo);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/**
 * El texto completo del testimonio; si pasa de `LARGO_LEER_MAS` caracteres, el comienzo y «Leer más».
 * Es lo único con estado de la tarjeta: el resto se dibuja igual en el servidor y en el constructor.
 */
export function TextoLeerMas({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const largo = texto.length > LARGO_LEER_MAS;
  return (
    <>
      <p className="whitespace-pre-line break-words">{largo && !abierto ? comienzoDelTexto(texto) : texto}</p>
      {largo ? (
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className="mt-2 text-sm font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--wsite-primary)" }}
        >
          {abierto ? "Leer menos" : "Leer más"}
        </button>
      ) : null}
    </>
  );
}
