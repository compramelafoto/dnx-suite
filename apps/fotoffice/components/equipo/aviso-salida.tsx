"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cerrarAvisoSalidaAction, pedirAvisoSalidaAction } from "@/lib/equipo/acciones-personales";

const ZONA = "America/Argentina/Buenos_Aires";
const MINUTOS_ANTES = 5;
const CADA_MS = 30_000;
/** Si el servidor todavía no lo da (relojes apenas corridos), se reintenta unas pocas veces. */
const INTENTOS = 4;

/** Día y minuto de ahora en hora argentina, con el reloj del navegador. */
function ahoraArgentina(): { fecha: string; minuto: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, minuto: Number(partes.hour) * 60 + Number(partes.minute) };
}

/**
 * El aviso amable de salida: aparece en cualquier pantalla 5 minutos antes del fin del horario,
 * si la persona tiene un turno abierto a su nombre. El servidor ya decidió que corresponde hoy
 * (`fecha` y `finMin`); acá sólo se espera la hora y se pide el texto, que el servidor vuelve a
 * verificar. Se cierra con la cruz y no vuelve ese día. Si algo falla, no aparece.
 */
export function AvisoSalida({ fecha, finMin }: { fecha: string; finMin: number }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState(false);
  const intentos = useRef(0);
  const enCurso = useRef(false);

  useEffect(() => {
    let vivo = true;
    function revisar() {
      if (enCurso.current || intentos.current >= INTENTOS) return;
      const ahora = ahoraArgentina();
      if (ahora.fecha !== fecha || ahora.minuto < finMin - MINUTOS_ANTES) return;
      enCurso.current = true;
      intentos.current += 1;
      pedirAvisoSalidaAction()
        .then((t) => {
          if (!vivo) return;
          if (t) {
            setTexto(t);
            intentos.current = INTENTOS;
          }
        })
        .catch(() => {})
        .finally(() => {
          enCurso.current = false;
        });
    }
    revisar();
    const id = window.setInterval(revisar, CADA_MS);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [fecha, finMin]);

  if (!texto || cerrado) return null;
  return (
    <div
      role="status"
      className="fo-card mb-4 flex items-start gap-3 border-l-4 border-l-[var(--fo-accent)] p-4 text-sm"
    >
      <p className="min-w-0 flex-1 text-base">{texto}</p>
      <button
        type="button"
        aria-label="Cerrar el aviso"
        className="fo-btn fo-btn-ghost min-h-8 px-2"
        onClick={() => {
          setCerrado(true);
          cerrarAvisoSalidaAction().catch(() => {});
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
