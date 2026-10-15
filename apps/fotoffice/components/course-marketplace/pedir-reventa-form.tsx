"use client";

import { useActionState, useMemo, useState } from "react";
import { pedirReventaAction, type EstadoFormulario } from "@/app/actions/course-resale";
import { formatoPorcentaje, type BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";
import { porcentajeABps, simularReventa } from "@/lib/course-marketplace/reventa";
import { pesos } from "@/lib/course-marketplace/formato";

const INICIAL: EstadoFormulario = { error: null, ok: null };

/**
 * "Quiero venderlo": la institución elige su % y el descuento para sus socios, y ve en vivo, con
 * el mismo motor que después cobra, cuánto se lleva por venta (spec, sección 6).
 */
export function PedirReventaForm({
  courseId,
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
  sugeridoBps,
}: {
  courseId: string;
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  sugeridoBps: number;
}) {
  const accionDelCurso = useMemo(() => pedirReventaAction.bind(null, courseId), [courseId]);
  const [estado, accion, enviando] = useActionState(accionDelCurso, INICIAL);
  const [porcentaje, setPorcentaje] = useState(String(sugeridoBps / 100).replace(".", ","));
  const [descuento, setDescuento] = useState("0");
  const pedidoBps = porcentajeABps(porcentaje) ?? 0;
  const descuentoBps = porcentajeABps(descuento) ?? 0;
  const sim = useMemo(
    () => simularReventa({ listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps, descuentoBps }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps, descuentoBps],
  );

  if (estado.ok) {
    return (
      <p className="text-sm" role="status">
        {estado.ok}
      </p>
    );
  }

  return (
    <form action={accion} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Tu %{" "}
          <input name="porcentaje" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
        </label>
        <label className="text-sm">
          Descuento para tus socios (%){" "}
          <input name="descuento" value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
        </label>
      </div>
      {sim.ok ? (
        <div className="space-y-1 text-sm">
          <p>
            Tu parte: <strong>{pesos(sim.parteCentavos)}</strong> por venta; podés darles a tus socios hasta {formatoPorcentaje(pedidoBps)} de descuento.
          </p>
          <p className="text-[var(--fo-muted)]">
            Paga el público {pesos(sim.pagaElAlumno)} · Paga tu socio {pesos(sim.pagaElSocio)}
          </p>
        </div>
      ) : (
        <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
          {sim.errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--fo-muted)]">
        {pedidoBps <= sugeridoBps
          ? "Hasta el % sugerido, el acuerdo queda activo al instante."
          : `Supera el ${formatoPorcentaje(sugeridoBps)} sugerido: el dueño tiene que aprobarlo.`}
      </p>
      {estado.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        Quiero venderlo
      </button>
    </form>
  );
}
