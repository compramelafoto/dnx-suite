"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GUESTBOOK_LIMITS } from "@repo/muestras";
import { dejarComentario } from "@/lib/libro/acciones";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioLibro({ muestra, revisa }: { muestra: string; revisa: boolean }) {
  const inicio = useRef(0);
  const [largo, setLargo] = useState(0);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, start] = useTransition();
  // Cuándo se abrió el formulario: lo que se envía antes de 3 segundos no lo escribió una persona.
  useEffect(() => {
    inicio.current = Date.now();
  }, []);

  if (estado?.ok) return <p role="status" className="border-t border-[var(--mf-line)] pt-4 text-lg">{estado.texto}</p>;
  return (
    <form
      className="space-y-4 border-t border-[var(--mf-line)] pt-6"
      action={(fd) => start(async () => {
        fd.set("t", inicio.current ? String(inicio.current) : "");
        const r = await dejarComentario(fd);
        setEstado(r.ok
          ? { ok: true, texto: r.publicado ? "¡Gracias! Tu comentario ya está en el libro." : "¡Gracias! Quien organiza la muestra lo va a leer antes de publicarlo." }
          : { ok: false, texto: r.error });
      })}
    >
      <input type="hidden" name="muestra" value={muestra} />
      {/* Campo trampa: invisible para las personas, los robots lo llenan. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>No completes este campo<input name="sitio" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="block">Tu comentario
        <textarea name="comentario" required rows={5} maxLength={GUESTBOOK_LIMITS.comment} className={campo} onChange={(e) => setLargo(e.target.value.length)} />
        <span className="text-sm text-[var(--mf-muted)]">{largo}/{GUESTBOOK_LIMITS.comment}</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">Tu nombre (optativo)<input name="nombre" maxLength={GUESTBOOK_LIMITS.name} className={campo} autoComplete="given-name" /></label>
        <label className="block">Tu ciudad (optativo)<input name="ciudad" maxLength={GUESTBOOK_LIMITS.city} className={campo} autoComplete="address-level2" /></label>
      </div>
      <p className="text-sm text-[var(--mf-muted)]">
        {revisa ? "Quien organiza lee cada comentario antes de publicarlo." : "Tu comentario se publica en la página de la muestra."} No guardamos tu IP ni te pedimos cuenta. Sin enlaces ni correos.
      </p>
      {estado && !estado.ok ? <p role="alert" className="text-[var(--mf-alerta)]">{estado.texto}</p> : null}
      <button type="submit" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50">
        {pendiente ? "Enviando…" : "Dejar mi comentario"}
      </button>
    </form>
  );
}
