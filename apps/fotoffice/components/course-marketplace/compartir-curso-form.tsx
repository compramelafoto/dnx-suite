"use client";

import { useActionState, useMemo, useState } from "react";
import { invitarAEspacioAction, type EstadoFormulario } from "@/app/actions/course-resale";
import { BPS_TOTAL, formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { porcentajeABps } from "@/lib/course-marketplace/reventa";
import { pesos } from "@/lib/course-marketplace/formato";

const INICIAL: EstadoFormulario = { error: null, ok: null };

/**
 * "Compartir con un espacio": el dueño elige el espacio, cuánto se queda de cada venta (100% es
 * regalarlo) y si es gratis para sus socios. El servidor vuelve a validar todo.
 */
export function CompartirCursoForm({
  courseId,
  espacios,
  listaCentavos,
  sinReparto,
}: {
  courseId: string;
  espacios: Array<{ id: string; nombre: string }>;
  listaCentavos: number;
  /** El dueño es el único beneficiario: puede regalarlo o darlo gratis a socios. */
  sinReparto: boolean;
}) {
  const accionDelCurso = useMemo(() => invitarAEspacioAction.bind(null, courseId), [courseId]);
  const [estado, accion, enviando] = useActionState(accionDelCurso, INICIAL);
  const [porcentaje, setPorcentaje] = useState(sinReparto ? "100" : "10");
  const bps = porcentajeABps(porcentaje);

  if (espacios.length === 0) {
    return <p className="text-sm text-[var(--fo-muted)]">No hay otros espacios con el módulo de cursos para compartirlo.</p>;
  }

  return (
    <form action={accion} className="fo-card space-y-3">
      <p className="font-medium">Compartir con un espacio</p>
      <label className="block text-sm">
        Espacio{" "}
        <select name="workspaceId" required defaultValue="" className="fo-input mt-1 block w-full">
          <option value="" disabled>
            Elegí un espacio
          </option>
          {espacios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Cuánto se queda ese espacio de cada venta (%){" "}
        <input
          name="porcentaje"
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
          inputMode="decimal"
          className="fo-input inline-block w-20"
        />
      </label>
      <p className="text-xs text-[var(--fo-muted)]">
        {bps === null || bps <= 0 || bps > BPS_TOTAL
          ? "Escribí un porcentaje entre 1 y 100."
          : bps === BPS_TOTAL
            ? "100% es regalarlo: ese espacio lo vende con su Mercado Pago y se queda con todo."
            : `Por cada venta de ${pesos(listaCentavos)}, ese espacio recibe ${pesos(Math.round((listaCentavos * bps) / BPS_TOTAL))} (${formatoPorcentaje(bps)}) y vos el resto. Las ventas con reparto se habilitan cuando Mercado Pago active el reparto automático.`}
      </p>
      <label className={`flex items-center gap-2 text-sm ${sinReparto ? "" : "opacity-60"}`}>
        <input type="checkbox" name="gratis" disabled={!sinReparto} />
        Gratis para sus socios activos
      </label>
      {!sinReparto ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Este curso tiene otros beneficiarios: no se puede regalar ni dar gratis, porque los demás quedarían sin cobrar.
        </p>
      ) : null}
      {estado.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="text-sm" role="status">
          {estado.ok}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        {enviando ? "Enviando…" : "Enviar invitación"}
      </button>
    </form>
  );
}
