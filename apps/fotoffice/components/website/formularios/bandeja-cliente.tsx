"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { cambiarEstadoEnviosAction, cambiarEstadoSuscriptorAction, type BandejaState } from "@/app/actions/website-formularios";

/** Las partes con estado de Sitio web → Formularios (la página es de servidor). */

const inicial: BandejaState = { error: null };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  NUEVO: { texto: "Nuevo", clase: "bg-[var(--fo-accent)] text-white" },
  LEIDO: { texto: "Leído", clase: "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]" },
  ARCHIVADO: { texto: "Archivado", clase: "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)] italic" },
};

export function InsigniaEstado({ estado }: { estado: string }) {
  const e = ESTADO[estado] ?? { texto: estado, clase: "" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${e.clase}`}>{e.texto}</span>;
}

export type FilaEnvio = {
  id: string;
  formulario: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  estado: string;
  fecha: string;
  resumen: string;
  href: string;
};

export function TablaEnvios({ filas, mostrarFormulario }: { filas: FilaEnvio[]; mostrarFormulario: boolean }) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(cambiarEstadoEnviosAction, inicial);
  const todos = filas.length > 0 && filas.every((f) => elegidos.has(f.id));

  const alternar = (id: string) =>
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <form
        // El FormData ya se armó con los elegidos: se limpia la selección y la lista se vuelve a leer.
        action={(fd) => {
          setElegidos(new Set());
          action(fd);
        }}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        {[...elegidos].map((id) => (
          <input key={id} type="hidden" name="id" value={id} />
        ))}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={todos}
            aria-label="Elegir todos los de esta página"
            onChange={() => setElegidos(todos ? new Set() : new Set(filas.map((f) => f.id)))}
          />
          {elegidos.size > 0 ? `${elegidos.size} elegidos` : "Elegir"}
        </label>
        <button type="submit" name="estado" value="LEIDO" className="fo-btn fo-btn-secondary text-xs" disabled={pending || elegidos.size === 0}>
          Marcar leídos
        </button>
        <button type="submit" name="estado" value="ARCHIVADO" className="fo-btn fo-btn-secondary text-xs" disabled={pending || elegidos.size === 0}>
          Archivar
        </button>
        <button type="submit" name="estado" value="NUEVO" className="fo-btn fo-btn-ghost text-xs" disabled={pending || elegidos.size === 0}>
          Marcar como nuevos
        </button>
        {state.error ? (
          <span className="text-[var(--fo-danger)]" role="alert">
            {state.error}
          </span>
        ) : null}
      </form>
      <ul className="divide-y divide-[var(--fo-border)]">
        {filas.map((f) => (
          <li key={f.id} className="flex items-start gap-3 py-2 text-sm">
            <input type="checkbox" className="mt-1" checked={elegidos.has(f.id)} onChange={() => alternar(f.id)} aria-label={`Elegir el envío de ${f.nombre || f.email || f.fecha}`} />
            <Link href={f.href} scroll={false} className="min-w-0 flex-1 space-y-0.5 hover:underline">
              <span className="flex flex-wrap items-center gap-2">
                <span className={f.estado === "NUEVO" ? "font-semibold text-[var(--fo-text)]" : "text-[var(--fo-text)]"}>
                  {f.nombre || f.email || f.telefono || "Sin nombre"}
                </span>
                {f.nombre && f.email ? <span className="text-[var(--fo-muted)]">{f.email}</span> : null}
                <InsigniaEstado estado={f.estado} />
              </span>
              <span className="block truncate text-xs text-[var(--fo-muted)]">
                {f.fecha}
                {mostrarFormulario ? ` · ${f.formulario}` : ""}
                {f.resumen ? ` · ${f.resumen}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Botones del detalle. Abrir un envío nuevo lo marca leído (una sola vez). */
export function DetalleAcciones({ id, estado }: { id: string; estado: string }) {
  const [state, action, pending] = useActionState(cambiarEstadoEnviosAction, inicial);
  const marcado = useRef(false);

  useEffect(() => {
    if (estado !== "NUEVO" || marcado.current) return;
    marcado.current = true;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("estado", "LEIDO");
    startTransition(() => action(fd));
  }, [id, estado, action]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {estado !== "ARCHIVADO" ? (
        <button type="submit" name="estado" value="ARCHIVADO" className="fo-btn fo-btn-secondary text-sm" disabled={pending}>
          Archivar
        </button>
      ) : (
        <button type="submit" name="estado" value="LEIDO" className="fo-btn fo-btn-secondary text-sm" disabled={pending}>
          Sacar de archivados
        </button>
      )}
      <button type="submit" name="estado" value="NUEVO" className="fo-btn fo-btn-ghost text-sm" disabled={pending}>
        Marcar como nuevo
      </button>
      {state.error ? (
        <span className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function FilaSuscriptor({ id, email, nombre, estado, fecha }: { id: string; email: string; nombre: string | null; estado: string; fecha: string }) {
  const [state, action, pending] = useActionState(cambiarEstadoSuscriptorAction, inicial);
  const activo = estado === "ACTIVO";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="break-all text-[var(--fo-text)]">
          {email}
          {nombre ? <span className="text-[var(--fo-muted)]"> · {nombre}</span> : null}
        </p>
        <p className="fo-helper">
          {activo ? "Activo" : "Dado de baja"} · desde {fecha}
        </p>
        {state.error ? (
          <p className="text-[var(--fo-danger)]" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="estado" value={activo ? "BAJA" : "ACTIVO"} />
        <button type="submit" className={`fo-btn text-xs ${activo ? "fo-btn-danger-outline" : "fo-btn-secondary"}`} disabled={pending}>
          {pending ? "Guardando…" : activo ? "Dar de baja" : "Reactivar"}
        </button>
      </form>
    </li>
  );
}
