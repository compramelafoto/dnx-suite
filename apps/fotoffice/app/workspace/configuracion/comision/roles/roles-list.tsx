"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { archiveRoleAction, duplicateRoleAction, type CommissionActionState } from "../actions";
import { EstadoAccion, enviarSinBorrar, pideConfirmacion, useAlCambiar } from "../estado-accion";

const inicial = undefined as CommissionActionState | undefined;

/**
 * Editar, Duplicar y Archivar un rol. Archivar con gente asignada pide confirmar nombrando a
 * esas personas; si nadie lo tiene, se archiva directo. Si entre que se cargó la pantalla y el
 * clic alguien lo recibió, la acción devuelve el pedido de confirmación y se muestra igual.
 */
export function RolAcciones({ roleId, nombre, personas }: { roleId: string; nombre: string; personas: string[] }) {
  const [duplicado, duplicar, duplicando] = useActionState(duplicateRoleAction, inicial);
  const [archivado, archivar, archivando] = useActionState(archiveRoleAction, inicial);
  const [confirmando, setConfirmando] = useState(false);
  const mostrarConfirmacion = confirmando;
  useAlCambiar(archivado, (s) => {
    if (pideConfirmacion(s)) setConfirmando(true);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={`/workspace/configuracion/comision/roles/${roleId}`} className="fo-btn fo-btn-secondary min-h-11">
          Editar permisos
        </Link>
        <form onSubmit={enviarSinBorrar(duplicar)}>
          <input type="hidden" name="roleId" value={roleId} />
          <button type="submit" className="fo-btn fo-btn-ghost min-h-11" disabled={duplicando}>
            {duplicando ? "Duplicando…" : "Duplicar"}
          </button>
        </form>
        {mostrarConfirmacion ? null : personas.length > 0 ? (
          <button type="button" className="fo-btn fo-btn-danger-outline min-h-11" onClick={() => setConfirmando(true)}>
            Archivar
          </button>
        ) : (
          <form onSubmit={enviarSinBorrar(archivar)}>
            <input type="hidden" name="roleId" value={roleId} />
            <button type="submit" className="fo-btn fo-btn-danger-outline min-h-11" disabled={archivando}>
              {archivando ? "Archivando…" : "Archivar"}
            </button>
          </form>
        )}
      </div>

      <EstadoAccion state={duplicado} okText={`Listo: se creó una copia de ${nombre}.`} />

      {mostrarConfirmacion ? (
        <form
          onSubmit={enviarSinBorrar(archivar)}
          className="fo-alert-error space-y-3 rounded-[var(--fo-radius-sm)] p-3"
        >
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="confirm" value="yes" />
          <p className="text-sm">
            {personas.length > 0 ? (
              <>
                ¿Archivar <strong>{nombre}</strong>? Se les va a quitar a: {personas.join(", ")}.
              </>
            ) : (
              archivado?.error
            )}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            El rol no se borra: queda en el historial de cada persona y deja de ofrecerse para asignar.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-danger min-h-11" disabled={archivando}>
              {archivando ? "Archivando…" : "Sí, archivar"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <EstadoAccion state={archivado?.error && !pideConfirmacion(archivado) ? archivado : undefined} />
      )}
    </div>
  );
}
