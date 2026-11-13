"use client";

import { useState } from "react";
import { ESPECIALES_PERIODO, ESPECIAL_PERIODO_ETIQUETA, formatearNota, valorParaMiEscuela, type EspecialPeriodo } from "@/lib/registro-docente/notas";
import type { Redondeo } from "@/lib/registro-docente/reglas";
import { guardarNotaPeriodoAction, marcarPasadaAction } from "../../../../actions";

export type FilaTablaPeriodo = {
  estudianteId: string;
  nombre: string;
  baja: boolean;
  ppi: boolean;
  /** Columnas de detalle (promedio por tipo, o notas de cada período para la final). */
  detalle: string[];
  pendientes: number;
  sugerida: number | null;
  final: number | null;
  especial: EspecialPeriodo | null;
  motivo: string | null;
  pasada: boolean;
  aprobacion: number;
  redondeo: Redondeo;
};

type Estado = "guardando" | "ok" | { error: string } | undefined;

export function TablaPeriodo({
  cursoId,
  periodo,
  columnasDetalle,
  filas,
  conMiEscuela,
  puedeEditar,
}: {
  cursoId: string;
  periodo: string;
  columnasDetalle: string[];
  filas: FilaTablaPeriodo[];
  conMiEscuela: boolean;
  puedeEditar: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--fo-border)]">
      <table className="text-sm">
        <thead className="bg-[var(--fo-surface-muted)] text-left">
          <tr>
            <th className="sticky left-0 z-10 min-w-48 bg-[var(--fo-surface-muted)] p-2">Estudiante</th>
            {columnasDetalle.map((c) => (
              <th key={c} className="p-2 font-medium">
                {c}
              </th>
            ))}
            <th className="p-2">Sugerida</th>
            <th className="p-2">Nota final</th>
            <th className="p-2">Motivo del cambio</th>
            {conMiEscuela ? <th className="p-2">Mi Escuela</th> : null}
            {conMiEscuela ? <th className="p-2">Pasada</th> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            // La clave incluye lo guardado: si el servidor trae otra nota (por ejemplo, «poner la sugerida»), la fila arranca de nuevo.
            <Fila key={`${f.estudianteId}:${f.final ?? ""}:${f.especial ?? ""}:${f.pasada}`} f={f} cursoId={cursoId} periodo={periodo} conMiEscuela={conMiEscuela} puedeEditar={puedeEditar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fila({ f, cursoId, periodo, conMiEscuela, puedeEditar }: { f: FilaTablaPeriodo; cursoId: string; periodo: string; conMiEscuela: boolean; puedeEditar: boolean }) {
  const [final, setFinal] = useState(f.final === null ? "" : formatearNota(f.final));
  const [especial, setEspecial] = useState<string>(f.especial ?? "");
  const [motivo, setMotivo] = useState(f.motivo ?? "");
  const [pasada, setPasada] = useState(f.pasada);
  const [estado, setEstado] = useState<Estado>();
  const [guardado, setGuardado] = useState({ final, especial, motivo });

  const numero = final.trim() ? Number(final.replace(",", ".")) : null;
  const valorOficial = valorParaMiEscuela(
    { final: numero !== null && Number.isFinite(numero) ? numero : null, especial: (especial || null) as EspecialPeriodo | null },
    { redondeo: f.redondeo },
  );
  const desaprobado = !especial && numero !== null && numero < f.aprobacion;
  const cambiada = !especial && numero !== null && f.sugerida !== null && Math.abs(numero - f.sugerida) > 0.001;

  function guardar(siguiente?: Partial<{ final: string; especial: string; motivo: string }>) {
    const v = { final, especial, motivo, ...siguiente };
    if (v.final === guardado.final && v.especial === guardado.especial && v.motivo === guardado.motivo) return;
    setEstado("guardando");
    guardarNotaPeriodoAction({ cursoId, estudianteId: f.estudianteId, periodo, final: v.final, especial: v.especial, motivo: v.motivo, sugerida: f.sugerida })
      .then((r) => {
        if (r.ok) {
          setGuardado(v);
          setEstado("ok");
        } else setEstado({ error: r.error });
      })
      .catch(() => setEstado({ error: "Sin conexión: no se guardó." }));
  }

  const error = typeof estado === "object" ? estado.error : null;
  return (
    <tr className={`border-t border-[var(--fo-border)] ${f.baja ? "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]" : ""}`}>
      <th scope="row" className={`sticky left-0 z-10 p-2 text-left font-normal ${f.baja ? "bg-[var(--fo-surface-muted)]" : "bg-[var(--fo-surface)]"}`}>
        {f.nombre}
        {f.ppi ? <span className="ml-1 rounded bg-[var(--fo-accent-soft)] px-1 text-xs">PPI</span> : null}
        {f.pendientes ? <span className="block text-xs text-[var(--fo-warning)]">{f.pendientes} {f.pendientes === 1 ? "evaluación pendiente" : "evaluaciones pendientes"}</span> : null}
      </th>
      {f.detalle.map((d, i) => (
        <td key={i} className="p-2 text-[var(--fo-muted)]">
          {d}
        </td>
      ))}
      <td className="p-2 font-medium">{f.sugerida === null ? "—" : formatearNota(f.sugerida)}</td>
      <td className="p-1">
        <div className="flex gap-1">
          <input
            value={final}
            disabled={!puedeEditar || Boolean(especial)}
            onChange={(e) => setFinal(e.target.value)}
            onBlur={() => guardar()}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            inputMode="decimal"
            placeholder={f.sugerida === null ? "" : formatearNota(f.sugerida)}
            aria-label={`Nota final de ${f.nombre}`}
            className={`w-16 rounded border bg-transparent px-2 py-1 ${error ? "border-[var(--fo-danger)]" : estado === "ok" ? "border-[var(--fo-success-border)]" : "border-[var(--fo-border)]"} ${desaprobado ? "text-[var(--fo-danger)]" : ""}`}
          />
          {puedeEditar && f.sugerida !== null && !final && !especial ? (
            <button
              type="button"
              className="rounded border border-[var(--fo-border)] px-2 text-xs"
              title="Poner la sugerida"
              onClick={() => {
                const s = formatearNota(f.sugerida!);
                setFinal(s);
                guardar({ final: s });
              }}
            >
              ←
            </button>
          ) : null}
          <select
            value={especial}
            disabled={!puedeEditar}
            onChange={(e) => {
              setEspecial(e.target.value);
              guardar({ especial: e.target.value });
            }}
            aria-label={`Valor especial de ${f.nombre}`}
            className="rounded border border-[var(--fo-border)] bg-transparent px-1 py-1 text-xs"
          >
            <option value="">Nota</option>
            {ESPECIALES_PERIODO.map((e) => (
              <option key={e} value={e}>
                {ESPECIAL_PERIODO_ETIQUETA[e]}
              </option>
            ))}
          </select>
        </div>
        {error ? <span className="block text-xs text-[var(--fo-danger)]">{error}</span> : null}
      </td>
      <td className="p-1">
        <input
          value={motivo}
          disabled={!puedeEditar}
          onChange={(e) => setMotivo(e.target.value)}
          onBlur={() => guardar()}
          maxLength={300}
          placeholder={cambiada ? "¿Por qué la cambiaste?" : ""}
          aria-label={`Motivo de ${f.nombre}`}
          className={`w-44 rounded border bg-transparent px-2 py-1 ${cambiada && !motivo ? "border-[var(--fo-warning-border)]" : "border-[var(--fo-border)]"}`}
        />
      </td>
      {conMiEscuela ? <td className="p-2 text-base font-semibold">{valorOficial || "—"}</td> : null}
      {conMiEscuela ? (
        <td className="p-2 text-center">
          <input
            type="checkbox"
            checked={pasada}
            disabled={!puedeEditar || !valorOficial || (!guardado.final && !guardado.especial)}
            onChange={(e) => {
              const marcada = e.target.checked;
              setPasada(marcada);
              marcarPasadaAction({ cursoId, estudianteId: f.estudianteId, periodo, pasada: marcada }).catch(() => setPasada(!marcada));
            }}
            aria-label={`Ya la pasé a Mi Escuela: ${f.nombre}`}
          />
        </td>
      ) : null}
    </tr>
  );
}
