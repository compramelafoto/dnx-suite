"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearTipoCitaAction, editarTipoCitaAction } from "@/app/actions/agenda";

type Tipo = { id: string; name: string; color: string; order: number; isActive: boolean };

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

/** Alta, cambio de nombre y color, orden y baja de los tipos de cita. */
export function TiposDeCita({ tipos }: { tipos: Tipo[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#2563eb");

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) return setError(r.error);
        alTerminar?.();
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function mover(i: number, paso: -1 | 1) {
    const otro = tipos[i + paso];
    const actual = tipos[i];
    if (!otro || !actual) return;
    // Se intercambian los lugares con el vecino.
    correr(async () => {
      const a = await editarTipoCitaAction(actual.id, { order: otro.order === actual.order ? Math.max(0, otro.order + paso) : otro.order });
      if (!a.ok) return a;
      return editarTipoCitaAction(otro.id, { order: actual.order });
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card divide-y divide-[var(--fo-border)] p-0" aria-label="Tipos de cita">
        {tipos.length === 0 ? <p className="p-4 text-sm text-[var(--fo-muted)]">Todavía no hay tipos de cita.</p> : null}
        {tipos.map((t, i) => (
          <FilaTipo key={`${t.id}:${t.name}:${t.color}:${t.isActive}`} tipo={t} pendiente={pendiente} primero={i === 0} ultimo={i === tipos.length - 1} onMover={(paso) => mover(i, paso)} correr={correr} />
        ))}
      </section>

      <form
        className="fo-card flex flex-wrap items-end gap-3 p-4"
        aria-label="Nuevo tipo de cita"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => crearTipoCitaAction({ name: nombre, color }), () => setNombre(""));
        }}
      >
        <label className="fo-field-stack min-w-0 flex-1">
          <span className="fo-label">Nuevo tipo</span>
          <input className="fo-input w-full" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo, Casting" />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Color</span>
          <input type="color" className="h-9 w-14 cursor-pointer rounded border border-[var(--fo-border)]" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || nombre.trim() === ""}>
          Agregar
        </button>
      </form>
    </div>
  );
}

function FilaTipo({
  tipo,
  pendiente,
  primero,
  ultimo,
  onMover,
  correr,
}: {
  tipo: Tipo;
  pendiente: boolean;
  primero: boolean;
  ultimo: boolean;
  onMover: (paso: -1 | 1) => void;
  correr: (accion: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [nombre, setNombre] = useState(tipo.name);
  const [color, setColor] = useState(tipo.color);
  const cambio = nombre.trim() !== tipo.name || color.toLowerCase() !== tipo.color.toLowerCase();
  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 ${tipo.isActive ? "" : "opacity-60"}`}>
      <input type="color" aria-label={`Color de ${tipo.name}`} className="h-8 w-12 cursor-pointer rounded border border-[var(--fo-border)]" value={color} disabled={pendiente} onChange={(e) => setColor(e.target.value)} />
      <input aria-label={`Nombre de ${tipo.name}`} className="fo-input min-w-0 flex-1" value={nombre} maxLength={80} disabled={pendiente} onChange={(e) => setNombre(e.target.value)} />
      {cambio ? (
        <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente || nombre.trim() === ""} onClick={() => correr(() => editarTipoCitaAction(tipo.id, { name: nombre, color }))}>
          Guardar
        </button>
      ) : null}
      <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente || primero} aria-label={`Subir ${tipo.name}`} onClick={() => onMover(-1)}>
        ↑
      </button>
      <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente || ultimo} aria-label={`Bajar ${tipo.name}`} onClick={() => onMover(1)}>
        ↓
      </button>
      <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente} onClick={() => correr(() => editarTipoCitaAction(tipo.id, { isActive: !tipo.isActive }))}>
        {tipo.isActive ? "Dar de baja" : "Reactivar"}
      </button>
    </div>
  );
}
