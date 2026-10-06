"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Bookmark, Pencil, Trash2, Users } from "lucide-react";
import { borrarVistaAction, guardarVistaAction, renombrarVistaAction } from "@/app/actions/listado";

export type VistaVisible = { id: string; name: string; shared: boolean; editable: boolean };

type Estado = { error: string | null; ok?: boolean };
const INICIAL: Estado = { error: null };

function ItemVista({ clave, ruta, vista }: { clave: string; ruta: string; vista: VistaVisible }) {
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [renombre, renombrar, renombrandoPendiente] = useActionState(async (prev: Estado, fd: FormData) => {
    const r = await renombrarVistaAction(prev, fd);
    if (r.ok) setEditando(false);
    return r;
  }, INICIAL);
  const [borrado, borrar, borrandoPendiente] = useActionState(borrarVistaAction, INICIAL);
  const error = renombre.error ?? borrado.error;

  if (editando) {
    return (
      <li className="px-3 py-2">
        <form action={renombrar} className="flex items-center gap-2">
          <input type="hidden" name="clave" value={clave} />
          <input type="hidden" name="id" value={vista.id} />
          <input name="nombre" className="fo-input !min-h-9" defaultValue={vista.name} maxLength={60} aria-label="Nuevo nombre" autoFocus required />
          <button type="submit" className="fo-btn fo-btn-primary !min-h-9 !px-3 text-sm" disabled={renombrandoPendiente}>
            Guardar
          </button>
          <button type="button" className="fo-btn fo-btn-ghost !min-h-9 !px-3 text-sm" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
        {error ? <p className="mt-1 text-xs text-[var(--fo-danger)]">{error}</p> : null}
      </li>
    );
  }

  return (
    <li className="px-3 py-1.5">
      <div className="flex items-center gap-1">
        <Link href={`${ruta}?vista=${encodeURIComponent(vista.id)}`} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--fo-surface-hover)]">
          <span className="truncate">{vista.name}</span>
          {vista.shared ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--fo-muted)]">
              <Users className="size-3" aria-hidden />
              Equipo
            </span>
          ) : null}
        </Link>
        {vista.editable && !borrando ? (
          <>
            <button type="button" className="fo-icon-btn" aria-label={`Renombrar ${vista.name}`} onClick={() => setEditando(true)}>
              <Pencil className="size-3.5" />
            </button>
            <button type="button" className="fo-icon-btn fo-icon-btn-danger" aria-label={`Borrar ${vista.name}`} onClick={() => setBorrando(true)}>
              <Trash2 className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>
      {borrando ? (
        <form action={borrar} className="mt-1 flex items-center gap-2 text-xs">
          <input type="hidden" name="clave" value={clave} />
          <input type="hidden" name="id" value={vista.id} />
          <span className="text-[var(--fo-text-secondary)]">¿Borrar esta vista?</span>
          <button type="submit" className="font-medium text-[var(--fo-danger)] underline" disabled={borrandoPendiente}>
            Sí, borrar
          </button>
          <button type="button" className="underline" onClick={() => setBorrando(false)}>
            No
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-1 text-xs text-[var(--fo-danger)]">{error}</p> : null}
    </li>
  );
}

/** Vistas guardadas de la lista: las propias y las compartidas con el equipo. */
export function MenuDeVistas({
  clave,
  ruta,
  vistas,
  queryActual,
  puedeCompartir,
}: {
  clave: string;
  ruta: string;
  vistas: VistaVisible[];
  queryActual: string;
  puedeCompartir: boolean;
}) {
  const [estado, guardar, guardando] = useActionState(guardarVistaAction, INICIAL);

  return (
    <details className="relative">
      <summary className="fo-btn fo-btn-secondary list-none cursor-pointer">
        <Bookmark className="size-4" aria-hidden />
        Vistas
      </summary>
      <div className="fo-popover absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] py-2">
        {vistas.length ? (
          <ul className="max-h-72 overflow-y-auto">
            {vistas.map((v) => (
              <ItemVista key={v.id} clave={clave} ruta={ruta} vista={v} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-2 text-sm text-[var(--fo-muted)]">Todavía no guardaste ninguna vista.</p>
        )}
        <form action={guardar} className="mt-2 flex flex-col gap-2 border-t border-[var(--fo-border)] px-4 pt-3">
          <input type="hidden" name="clave" value={clave} />
          <input type="hidden" name="query" value={queryActual} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="fo-label">Guardar vista actual</span>
            <input name="nombre" className="fo-input" placeholder="Por ejemplo: Deudores" maxLength={60} required />
          </label>
          {puedeCompartir ? (
            <label className="flex items-center gap-2 text-sm text-[var(--fo-text-secondary)]">
              <input type="checkbox" name="compartida" className="size-4 accent-[var(--fo-accent)]" />
              Compartir con el equipo
            </label>
          ) : null}
          <button type="submit" className="fo-btn fo-btn-primary" disabled={guardando}>
            Guardar
          </button>
          {estado.error ? <p className="text-sm text-[var(--fo-danger)]">{estado.error}</p> : null}
          {estado.ok ? <p className="text-sm text-[var(--fo-success)]">Vista guardada.</p> : null}
        </form>
      </div>
    </details>
  );
}
