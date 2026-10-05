"use client";

import { useActionState, useMemo, useState } from "react";
import { guardarOfertaAction, type EstadoFormulario } from "@/app/actions/course-resale";
import type { BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";
import { porcentajeABps, simularReventa } from "@/lib/course-marketplace/reventa";
import { pesos } from "@/lib/course-marketplace/formato";

const INICIAL: EstadoFormulario = { error: null, ok: null };

/** "Ofrecer a otras instituciones" y el % sugerido, con lo que cobraría un revendedor por venta. */
export function OfertaReventaForm({
  courseId,
  ofrecido,
  sugeridoBps,
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
}: {
  courseId: string;
  ofrecido: boolean;
  sugeridoBps: number | null;
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
}) {
  const accionDelCurso = useMemo(() => guardarOfertaAction.bind(null, courseId), [courseId]);
  const [estado, accion, enviando] = useActionState(accionDelCurso, INICIAL);
  const [sugerido, setSugerido] = useState(sugeridoBps === null ? "20" : String(sugeridoBps / 100).replace(".", ","));
  const bps = porcentajeABps(sugerido) ?? 0;
  const sim = useMemo(
    () => simularReventa({ listaCentavos, comisionPlataformaBps, beneficiarios, pedidoBps: bps, descuentoBps: 0 }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, bps],
  );

  return (
    <form action={accion} className="fo-card space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="ofrecido" defaultChecked={ofrecido} />
        Ofrecer a otras instituciones
      </label>
      <label className="text-sm">
        % sugerido para revendedores{" "}
        <input name="sugerido" value={sugerido} onChange={(e) => setSugerido(e.target.value)} inputMode="decimal" className="fo-input inline-block w-20" />
      </label>
      {sim.ok ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Con ese %, quien lo revende cobra {pesos(sim.parteCentavos)} por venta y el resto se reparte entre los beneficiarios. Hasta ese %, los pedidos se aprueban solos; por encima, te llegan para aprobar.
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
        Guardar
      </button>
    </form>
  );
}
