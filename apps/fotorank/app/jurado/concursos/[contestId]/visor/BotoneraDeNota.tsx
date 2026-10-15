"use client";

import { useEffect, useState } from "react";
import {
  formaDeLaNota,
  textoDeLaNota,
} from "../../../../lib/fotorank/jury/formaDeLaNota";

type Criterio = { key: string; nombre: string; min: number; max: number };
type Colores = { chip: string; linea: string; suave: string };

const ELEGIDO = {
  background: "#e0a061",
  border: "1px solid #e0a061",
  color: "#1b1917",
  fontWeight: 600,
};

/**
 * Donde se pone la nota de un criterio. Toma la forma de su escala: números,
 * "Sí / No" o un campo para escribir (ver `formaDeLaNota`).
 */
export function BotoneraDeNota({
  criterio,
  puesta,
  habilitado,
  onElegir,
  colores,
  alto = "h-8",
  acostado = false,
}: {
  criterio: Criterio;
  puesta: number | undefined;
  habilitado: boolean;
  onElegir: (valor: number) => void;
  colores: Colores;
  alto?: string;
  /** Teléfono acostado: los botones van en dos columnas y ocupan el alto. */
  acostado?: boolean;
}) {
  const forma = formaDeLaNota(criterio);
  const suelto = {
    background: colores.chip,
    border: `1px solid ${colores.linea}`,
    color: colores.suave,
  };

  if (forma === "CAMPO") {
    return (
      <CampoDeNota
        criterio={criterio}
        puesta={puesta}
        habilitado={habilitado}
        onElegir={onElegir}
        colores={colores}
        alto={alto}
      />
    );
  }

  const valores =
    forma === "SI_NO"
      ? [0, 1]
      : Array.from(
          { length: criterio.max - criterio.min + 1 },
          (_, k) => criterio.min + k,
        );

  return (
    <div
      /*
       * Acostado, una sola columna.
       *
       * Eran dos cuando los criterios vivían en una columna de 200 píxeles al
       * costado. Esa versión tapaba la obra, así que la franja bajó a 72 y ahí
       * dos columnas dejarían botones de 34 píxeles: imposibles de acertar con
       * el pulgar.
       */
      className={
        acostado ? "flex min-h-0 flex-1 flex-col gap-px" : "flex gap-0.5"
      }
      role="radiogroup"
      aria-label={
        forma === "SI_NO"
          ? `${criterio.nombre}, sí o no`
          : `${criterio.nombre}, del ${criterio.min} al ${criterio.max}`
      }
    >
      {valores.map((valor) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={puesta === valor}
          aria-label={`${textoDeLaNota(criterio, valor)} en ${criterio.nombre}`}
          disabled={!habilitado}
          onClick={() => onElegir(valor)}
          className={`min-w-0 font-mono font-medium ${
            acostado
              ? "min-h-0 flex-1 text-[11px]"
              : `${alto} flex-1 text-[12px]`
          }`}
          style={puesta === valor ? ELEGIDO : suelto}
        >
          {textoDeLaNota(criterio, valor)}
        </button>
      ))}
    </div>
  );
}

/** Para escalas largas (0 a 100): se escribe el número y se confirma con Enter o al salir. */
function CampoDeNota({
  criterio,
  puesta,
  habilitado,
  onElegir,
  colores,
  alto,
}: {
  criterio: Criterio;
  puesta: number | undefined;
  habilitado: boolean;
  onElegir: (valor: number) => void;
  colores: Colores;
  alto: string;
}) {
  const [texto, setTexto] = useState(puesta != null ? String(puesta) : "");
  useEffect(() => {
    setTexto(puesta != null ? String(puesta) : "");
  }, [puesta]);

  function confirmar() {
    const n = Number(texto);
    if (
      texto.trim() !== "" &&
      Number.isInteger(n) &&
      n >= criterio.min &&
      n <= criterio.max
    ) {
      onElegir(n);
    } else {
      setTexto(puesta != null ? String(puesta) : "");
    }
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={criterio.min}
      max={criterio.max}
      step={1}
      value={texto}
      disabled={!habilitado}
      aria-label={`${criterio.nombre}, del ${criterio.min} al ${criterio.max}`}
      placeholder={`${criterio.min}–${criterio.max}`}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        // El visor escucha el teclado entero: acá adentro los números son del campo.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          confirmar();
        }
      }}
      className={`${alto} w-full px-2 font-mono text-[14px]`}
      style={{
        background: colores.chip,
        border: `1px solid ${colores.linea}`,
        color: "inherit",
      }}
    />
  );
}
