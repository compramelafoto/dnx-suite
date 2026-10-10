"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RSVP_LIMITS } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { confirmarAsistencia, type ResultadoAsistencia } from "@/lib/inauguracion/publicas";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

/** Formulario "Voy" (D15): sin cuenta, con el anti-spam del libro de visitas. */
export function FormularioAsistencia({ muestra, maxAcompanantes }: { muestra: string; maxAcompanantes: number }) {
  const inicio = useRef(0);
  const [pendiente, start] = useTransition();
  const [r, setR] = useState<ResultadoAsistencia | null>(null);
  // Cuándo se abrió el formulario: lo que se envía antes de 3 segundos no lo escribió una persona.
  useEffect(() => {
    inicio.current = Date.now();
  }, []);

  if (r?.ok) {
    return (
      <div role="status" className="space-y-4 border-t border-[var(--mf-line)] pt-6">
        <p className="text-lg">
          {r.estado === "CONFIRMED"
            ? "¡Listo! Te esperamos."
            : "El cupo está completo: quedaste en lista de espera. Si se libera un lugar, te pasamos en orden de llegada."}
        </p>
        {r.enlace ? (
          <div className="space-y-2 rounded-[2px] border border-[var(--mf-line)] p-4">
            <p>Guardá este enlace para ver o cancelar tu lugar.</p>
            <CopiarEnlace url={r.enlace} etiqueta="Tu enlace personal" />
            <p className="text-sm text-[var(--mf-muted)]">No lo vamos a volver a mostrar. Es sólo tuyo: no lo compartas.</p>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <form
      className="space-y-4 border-t border-[var(--mf-line)] pt-6"
      action={(fd) => start(async () => {
        fd.set("t", inicio.current ? String(inicio.current) : "");
        setR(await confirmarAsistencia(fd));
      })}
    >
      <h2 className="text-lg">Confirmá tu asistencia</h2>
      <input type="hidden" name="muestra" value={muestra} />
      {/* Campo trampa: invisible para las personas, los robots lo llenan. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>No completes este campo<input name="sitio" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="block">Tu nombre<input name="nombre" required minLength={2} maxLength={RSVP_LIMITS.name} className={campo} autoComplete="name" /></label>
      <label className="block">
        Tu email (optativo)
        <input name="email" type="email" maxLength={254} className={campo} autoComplete="email" />
        <span className="text-sm text-[var(--mf-muted)]">Para avisarte si se libera un lugar y mandarte tu enlace.</span>
      </label>
      {maxAcompanantes > 0 ? (
        <label className="block">
          ¿Cuántas personas vienen con vos?
          <select name="acompanantes" className={campo} defaultValue="0">
            {Array.from({ length: maxAcompanantes + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Voy solo/a" : n}</option>)}
          </select>
        </label>
      ) : null}
      {r && !r.ok ? <p role="alert" className="text-[var(--mf-alerta)]">{r.error}</p> : null}
      <button type="submit" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] bg-[var(--mf-ink)] px-5 text-[var(--mf-bg)] disabled:opacity-50">
        {pendiente ? "Enviando…" : "Voy"}
      </button>
      <p className="text-sm text-[var(--mf-muted)]">Tus datos los ve sólo quien organiza. Se borran 30 días después de que termina la muestra.</p>
    </form>
  );
}
