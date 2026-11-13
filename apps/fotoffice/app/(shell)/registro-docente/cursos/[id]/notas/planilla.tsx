"use client";

import { useEffect, useRef, useState } from "react";
import { leerCelda } from "@/lib/registro-docente/notas";
import { guardarCeldaAction } from "../../../actions";

export type ColumnaPlanilla = {
  id: string;
  titulo: string;
  subtitulo: string;
  notaMaxima: number;
  esRecuperatorio: boolean;
};
export type FilaPlanilla = {
  id: string;
  nombre: string;
  baja: boolean;
  ppi: boolean;
  celdas: Record<string, string>;
};

type Estado = "guardando" | "ok" | { error: string };

/**
 * La planilla del curso como una hoja de cálculo: estudiantes en filas, evaluaciones en columnas.
 * Cada celda se guarda sola al salir de ella (o con Enter, que baja a la fila siguiente).
 */
export function Planilla({
  columnas,
  filas,
  puedeEditar,
}: {
  columnas: ColumnaPlanilla[];
  filas: FilaPlanilla[];
  puedeEditar: boolean;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      filas.flatMap((f) =>
        columnas.map((c) => [`${f.id}:${c.id}`, f.celdas[c.id] ?? ""]),
      ),
    ),
  );
  const guardados = useRef<Record<string, string>>({ ...valores });
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const guardando = Object.values(estados).filter(
    (e) => e === "guardando",
  ).length;

  // Si quedan notas viajando, el navegador avisa antes de cerrar o cambiar de página.
  useEffect(() => {
    if (!guardando) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [guardando]);

  function guardar(estudianteId: string, col: ColumnaPlanilla) {
    const k = `${estudianteId}:${col.id}`;
    const texto = valores[k] ?? "";
    if (texto === guardados.current[k]) return;
    const leida = leerCelda(texto, col.notaMaxima);
    if (!leida.ok) {
      setEstados((s) => ({ ...s, [k]: { error: leida.error } }));
      return;
    }
    setEstados((s) => ({ ...s, [k]: "guardando" }));
    guardarCeldaAction({ evaluacionId: col.id, estudianteId, texto })
      .then((r) => {
        if (r.ok) {
          guardados.current[k] = texto;
          setEstados((s) => ({ ...s, [k]: "ok" }));
        } else {
          setEstados((s) => ({ ...s, [k]: { error: r.error } }));
        }
      })
      .catch(() =>
        setEstados((s) => ({
          ...s,
          [k]: { error: "Sin conexión: no se guardó. Probá de nuevo." },
        })),
      );
  }

  function bajar(fila: number, col: number) {
    const el = document.querySelector<HTMLInputElement>(
      `[data-celda="${fila + 1}:${col}"]`,
    );
    el?.focus();
    el?.select();
  }

  if (!columnas.length)
    return (
      <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
        Todavía no hay evaluaciones en este período. Creá una acá abajo.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--fo-muted)]" role="status">
        {guardando
          ? `Guardando ${guardando} ${guardando === 1 ? "nota" : "notas"}… no cierres la página.`
          : "Todo guardado."}
      </p>
      <div className="overflow-x-auto rounded border border-[var(--fo-border)]">
        <table className="text-sm">
          <thead className="bg-[var(--fo-surface-muted)]">
            <tr>
              <th className="sticky left-0 z-10 min-w-48 bg-[var(--fo-surface-muted)] p-2 text-left">
                Estudiante
              </th>
              {columnas.map((c) => (
                <th
                  key={c.id}
                  className="min-w-24 p-2 text-left align-bottom font-medium"
                >
                  <span className="block">{c.titulo}</span>
                  <span className="block text-xs font-normal text-[var(--fo-muted)]">
                    {c.subtitulo}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, fi) => (
              <tr
                key={f.id}
                className={`border-t border-[var(--fo-border)] ${f.baja ? "text-[var(--fo-muted)]" : ""}`}
              >
                <th
                  scope="row"
                  className={`sticky left-0 z-10 p-2 text-left font-normal ${f.baja ? "bg-[var(--fo-surface-muted)]" : "bg-[var(--fo-surface)]"}`}
                >
                  {f.nombre}
                  {f.ppi ? (
                    <span className="ml-1 rounded bg-[var(--fo-accent-soft)] px-1 text-xs">
                      PPI
                    </span>
                  ) : null}
                </th>
                {columnas.map((c, ci) => {
                  const k = `${f.id}:${c.id}`;
                  const est = estados[k];
                  const error = typeof est === "object" ? est.error : null;
                  return (
                    <td key={c.id} className="p-1">
                      <input
                        data-celda={`${fi}:${ci}`}
                        value={valores[k] ?? ""}
                        disabled={!puedeEditar}
                        onChange={(e) =>
                          setValores((v) => ({ ...v, [k]: e.target.value }))
                        }
                        onBlur={() => guardar(f.id, c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            guardar(f.id, c);
                            bajar(fi, ci);
                          }
                        }}
                        inputMode="decimal"
                        aria-label={`${c.titulo}: ${f.nombre}`}
                        aria-invalid={Boolean(error)}
                        title={error ?? undefined}
                        className={`w-20 rounded border px-2 py-1 ${error ? "border-[var(--fo-danger)]" : est === "ok" ? "border-[var(--fo-success-border)]" : "border-[var(--fo-border)]"} bg-transparent`}
                      />
                      {error ? (
                        <span className="block max-w-32 text-xs text-[var(--fo-danger)]">
                          {error}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
