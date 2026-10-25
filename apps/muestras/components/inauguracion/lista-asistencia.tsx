"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RSVP_ENTRY_STATUS_LABELS, formatArClock, formatArDay, partySize, type RsvpEntryStatus } from "@repo/muestras";
import { cambiarAsistencia, cerrarConfirmaciones } from "@/lib/inauguracion/acciones";

type Fila = { id: string; name: string; email: string | null; companions: number; status: string; createdAt: Date; promotedAt: Date | null };

const fecha = (d: Date) => `${formatArDay(d)} ${formatArClock(d)}`;
const accionChica = "text-sm underline underline-offset-4 disabled:opacity-40";

/** La lista para el equipo (D20): tabla en pantallas anchas, tarjetas en el teléfono. */
export function ListaAsistencia({ activityId, filas, abierta }: { activityId: string; filas: Fila[]; abierta: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>) =>
    start(async () => {
      const r = await f();
      setError(r.ok ? null : (r.errores ?? []).join(" "));
      if (r.ok) router.refresh();
    });

  const acciones = (k: Fila) => (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      {k.status !== "CONFIRMED" ? <button type="button" disabled={pendiente} className={accionChica} onClick={() => correr(() => cambiarAsistencia(k.id, "confirm"))}>Confirmar</button> : null}
      {k.status === "CONFIRMED" ? <button type="button" disabled={pendiente} className={accionChica} onClick={() => correr(() => cambiarAsistencia(k.id, "waitlist"))}>Pasar a espera</button> : null}
      {k.status !== "CANCELLED" ? (
        <button type="button" disabled={pendiente} className={accionChica} onClick={() => { if (window.confirm(`¿Cancelar la confirmación de ${k.name}?`)) correr(() => cambiarAsistencia(k.id, "cancel")); }}>Cancelar</button>
      ) : null}
    </span>
  );
  const estado = (k: Fila) => (
    <>
      {RSVP_ENTRY_STATUS_LABELS[k.status as RsvpEntryStatus] ?? k.status}
      {k.status === "CONFIRMED" && k.promotedAt ? <span className="block text-xs text-[var(--mf-muted)]">Pasó de la lista de espera el {fecha(k.promotedAt)}{k.email ? ": avisale por mail" : ""}</span> : null}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <a href={`/api/inauguracion/${activityId}/csv`} className="inline-flex h-11 items-center rounded-[2px] border border-[var(--mf-ink)] px-5">Bajar la lista (CSV)</a>
        {abierta ? (
          <button type="button" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50"
            onClick={() => { if (window.confirm("¿Cerrar las confirmaciones? La invitación sigue visible, pero ya no se anota nadie.")) correr(() => cerrarConfirmaciones(activityId)); }}>
            Cerrar confirmaciones
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-[var(--mf-alerta)]">{error}</p> : null}
      {filas.length === 0 ? <p className="text-[var(--mf-muted)]">Todavía no confirmó nadie.</p> : (
        <>
          <table className="hidden w-full border-t border-[var(--mf-line)] text-left text-[15px] md:table">
            <thead className="text-sm text-[var(--mf-muted)]">
              <tr className="border-b border-[var(--mf-line)]"><th className="py-2 font-normal">Nombre</th><th className="font-normal">Email</th><th className="font-normal">Personas</th><th className="font-normal">Estado</th><th className="font-normal">Confirmó</th><th /></tr>
            </thead>
            <tbody>
              {filas.map((k) => (
                <tr key={k.id} className="border-b border-[var(--mf-line)] align-top">
                  <td className="py-2 pr-3">{k.name}</td>
                  <td className="break-all pr-3">{k.email ?? "—"}</td>
                  <td className="pr-3">{partySize(k.companions)}</td>
                  <td className="pr-3">{estado(k)}</td>
                  <td className="pr-3 text-sm">{fecha(k.createdAt)}</td>
                  <td>{acciones(k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="border-t border-[var(--mf-line)] md:hidden">
            {filas.map((k) => (
              <li key={k.id} className="space-y-1 border-b border-[var(--mf-line)] py-3">
                <p className="flex flex-wrap justify-between gap-x-3"><span>{k.name}</span><span className="text-sm">{partySize(k.companions) === 1 ? "1 persona" : `${partySize(k.companions)} personas`}</span></p>
                {k.email ? <p className="break-all text-sm text-[var(--mf-muted)]">{k.email}</p> : null}
                <p className="text-sm">{estado(k)} · {fecha(k.createdAt)}</p>
                {acciones(k)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
