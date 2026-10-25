"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reasignarTareasAction } from "@/app/actions/proyectos";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

/** Pasa todas las tareas pendientes del proyecto a otra persona del equipo (o las deja sin responsable). */
export function ReasignarTareas({ proyectoId, equipo, hayPendientes }: { proyectoId: string; equipo: { id: number; nombre: string }[]; hayPendientes: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [destino, setDestino] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  if (!hayPendientes) return null;

  function reasignar() {
    setMensaje(null);
    iniciar(async () => {
      try {
        const r = await reasignarTareasAction(proyectoId, { haciaUserId: destino === "" ? null : Number(destino) });
        if (!r.ok) {
          setMensaje({ ok: false, texto: r.error });
          return;
        }
        setMensaje({ ok: true, texto: r.reasignadas === 1 ? "Se reasignó 1 tarea." : `Se reasignaron ${r.reasignadas} tareas.` });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: MENSAJE_FALLA });
      }
    });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded border border-[var(--fo-border)] p-3 text-sm"
      aria-label="Reasignar tareas pendientes"
      onSubmit={(e) => {
        e.preventDefault();
        reasignar();
      }}
    >
      <label className="fo-field-stack">
        <span className="fo-label">Pasar las tareas pendientes a</span>
        <select className="fo-input" value={destino} onChange={(e) => setDestino(e.target.value)} disabled={pendiente}>
          <option value="">Nadie (sin responsable)</option>
          {equipo.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente}>
        {pendiente ? "Reasignando…" : "Reasignar"}
      </button>
      {mensaje ? (
        <p role={mensaje.ok ? "status" : "alert"} className={`w-full text-sm ${mensaje.ok ? "text-[var(--fo-muted)]" : "text-[var(--fo-danger)]"}`}>
          {mensaje.texto}
        </p>
      ) : null}
    </form>
  );
}
