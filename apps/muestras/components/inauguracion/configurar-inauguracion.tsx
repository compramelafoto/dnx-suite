"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RSVP_LIMITS, RSVP_MODES, type RsvpMode } from "@repo/muestras";
import { guardarInauguracion } from "@/lib/inauguracion/acciones";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

const MODOS: Record<RsvpMode, { titulo: string; texto: string }> = {
  OFF: { titulo: "Entrada libre", texto: "La invitación muestra los datos y dice que no hace falta confirmar." },
  OPEN: { titulo: "Pedir confirmación", texto: "Quien quiera ir deja su nombre (y si quiere, su email). Con cupo, quien no entra queda en lista de espera." },
  CLOSED: { titulo: "Confirmaciones cerradas", texto: "La invitación sigue visible, pero ya no se reciben confirmaciones." },
};

export function ConfigurarInauguracion({ inicial }: {
  inicial: { id: string; rsvpStatus: string; rsvpCapacity: number | null; rsvpMaxCompanions: number; openingNote: string | null; conHora: boolean };
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [modo, setModo] = useState<string>(inicial.rsvpStatus);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", inicial.id);
        start(async () => {
          const r = await guardarInauguracion(fd);
          setMensaje(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.errores.join(" ") });
          if (r.ok) router.refresh();
        });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg">Confirmación de asistencia</legend>
        {RSVP_MODES.map((m) => (
          <label key={m} className="flex gap-3 border-b border-[var(--mf-line)] py-2">
            <input type="radio" name="rsvpStatus" value={m} checked={modo === m} onChange={() => setModo(m)} disabled={m === "OPEN" && !inicial.conHora && modo !== "OPEN"} className="mt-1.5" />
            <span>
              <span className="block">{MODOS[m].titulo}</span>
              <span className="block text-sm text-[var(--mf-muted)]">{MODOS[m].texto}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Cupo (personas, contando acompañantes)
          <input name="rsvpCapacity" inputMode="numeric" pattern="\d*" maxLength={4} className={campo} defaultValue={inicial.rsvpCapacity ?? ""} placeholder="Vacío = sin cupo" />
        </label>
        <label>
          Acompañantes por persona
          <select name="rsvpMaxCompanions" className={campo} defaultValue={String(inicial.rsvpMaxCompanions)}>
            {Array.from({ length: RSVP_LIMITS.maxCompanions + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Ninguno (invitación personal)" : n}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        Nota para la invitación (opcional)
        <textarea name="openingNote" rows={2} maxLength={RSVP_LIMITS.note} className={campo} defaultValue={inicial.openingNote ?? ""} placeholder="Habrá un brindis y palabras de la curadora" />
      </label>
      {mensaje ? <p role="status" className={mensaje.ok ? "text-[var(--mf-teal)]" : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
      <button type="submit" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50">
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
