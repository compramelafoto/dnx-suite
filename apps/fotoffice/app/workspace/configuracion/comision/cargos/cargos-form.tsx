"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  archiveOfficeAction,
  createOfficeAction,
  moveOfficeAction,
  updateOfficeAction,
  type CommissionActionState,
} from "../actions";
import { EstadoAccion, enviarSinBorrar, pideConfirmacion, useAlCambiar } from "../estado-accion";

const inicial = undefined as CommissionActionState | undefined;

/** Un cargo: nombre y "vota" se guardan juntos; subir, bajar y archivar son botones aparte. */
export function CargoFila({
  office,
  ocupantes,
  primero,
  ultimo,
}: {
  office: { id: string; name: string; votes: boolean };
  ocupantes: number;
  primero: boolean;
  ultimo: boolean;
}) {
  const [guardado, guardar, guardando] = useActionState(updateOfficeAction, inicial);
  const [movido, mover, moviendo] = useActionState(moveOfficeAction, inicial);
  const [archivado, archivar, archivando] = useActionState(archiveOfficeAction, inicial);
  const [confirmar, setConfirmar] = useState(false);
  useAlCambiar(archivado, (s) => {
    if (pideConfirmacion(s)) setConfirmar(true);
  });

  return (
    <li className="fo-card space-y-3 p-4">
      <form onSubmit={enviarSinBorrar(guardar)} className="space-y-3">
        <input type="hidden" name="officeId" value={office.id} />
        <label className="block space-y-1">
          <span className="fo-label">Nombre del cargo</span>
          <input name="name" className="fo-input" defaultValue={office.name} maxLength={60} autoComplete="off" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="votes" defaultChecked={office.votes} />
          Integra la comisión y vota
        </label>
        <p className="fo-helper">
          {ocupantes === 0
            ? "Nadie ocupa este cargo ahora."
            : ocupantes === 1
              ? "Lo ocupa 1 persona."
              : `Lo ocupan ${ocupantes} personas.`}
        </p>
        <EstadoAccion state={guardado} />
        <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--fo-border)] pt-3">
        <form onSubmit={enviarSinBorrar(mover)} className="flex gap-2">
          <input type="hidden" name="officeId" value={office.id} />
          <button
            type="submit"
            name="direction"
            value="up"
            className="fo-btn fo-btn-ghost min-h-11"
            disabled={primero || moviendo}
            aria-label={`Subir ${office.name}`}
          >
            ↑ Subir
          </button>
          <button
            type="submit"
            name="direction"
            value="down"
            className="fo-btn fo-btn-ghost min-h-11"
            disabled={ultimo || moviendo}
            aria-label={`Bajar ${office.name}`}
          >
            ↓ Bajar
          </button>
        </form>

        <form onSubmit={enviarSinBorrar(archivar)} className="ml-auto">
          <input type="hidden" name="officeId" value={office.id} />
          {confirmar ? null : (
            <button type="submit" className="fo-btn fo-btn-danger-outline min-h-11" disabled={archivando}>
              {archivando ? "Archivando…" : "Archivar"}
            </button>
          )}
        </form>
      </div>
      <EstadoAccion state={movido?.error ? movido : undefined} />

      {confirmar ? (
        <form
          onSubmit={enviarSinBorrar(archivar)}
          className="fo-alert-error space-y-3 rounded-[var(--fo-radius-sm)] p-3"
        >
          <input type="hidden" name="officeId" value={office.id} />
          <input type="hidden" name="confirm" value="yes" />
          <p className="text-sm">{archivado?.error}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            Los mandatos quedan en el historial. El cargo deja de aparecer para sumar gente.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-danger min-h-11" disabled={archivando}>
              {archivando ? "Archivando…" : "Sí, archivar"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <EstadoAccion state={archivado?.error && !pideConfirmacion(archivado) ? archivado : undefined} />
      )}
    </li>
  );
}

export function NuevoCargo() {
  const [state, dispatch, pending] = useActionState(createOfficeAction, inicial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={enviarSinBorrar(dispatch)} className="fo-card space-y-3 p-4 sm:p-5">
      <h2 className="text-base font-semibold">Nuevo cargo</h2>
      <label className="block space-y-1">
        <span className="fo-label">Nombre</span>
        <input name="name" className="fo-input" maxLength={60} placeholder="Ej.: Vocal suplente" autoComplete="off" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="votes" defaultChecked />
        Integra la comisión y vota
      </label>
      <EstadoAccion state={state} okText="Cargo creado. Quedó al final de la lista." />
      <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
        {pending ? "Creando…" : "Crear cargo"}
      </button>
    </form>
  );
}
