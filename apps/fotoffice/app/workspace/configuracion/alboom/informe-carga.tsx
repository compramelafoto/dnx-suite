import type { VistaCarga } from "@/lib/alboom/carga/cargas";
import type { GrupoMotivo } from "@/lib/alboom/carga/informe";
import { fechaHoraBA } from "@/lib/ficha/formato";

/**
 * El informe de una simulación o carga: por parte, cuántos se crean, actualizan, quedan iguales, se omiten, tienen
 * conflictos, errores o dudas, con los motivos agrupados. Sólo cantidades, motivos e ids de Alboom: el informe
 * nunca guarda nombres, correos ni teléfonos.
 */

const n = (v: number) => v.toLocaleString("es-AR");

const ESTADO: Record<VistaCarga["status"], string> = {
  PENDIENTE: "Esperando la primera tanda",
  CORRIENDO: "En curso",
  LISTA: "Terminada",
  ERROR: "Frenada por un error",
  CANCELADA: "Cancelada",
};

const GRUPOS: { grupo: GrupoMotivo; titulo: string }[] = [
  { grupo: "omitidos", titulo: "Omitidos" },
  { grupo: "conflictos", titulo: "Conflictos" },
  { grupo: "errores", titulo: "Errores" },
  { grupo: "dudas", titulo: "Dudas" },
];

export function InformeCarga({ titulo, carga, nombres }: { titulo: string; carga: VistaCarga; nombres: Record<string, string> }) {
  const simulacion = carga.mode === "SIMULACION";
  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">{titulo}</h3>
        <p>
          <span className="font-medium">{ESTADO[carga.status]}</span> · empezó el {fechaHoraBA(carga.startedAt)}
          {carga.finishedAt ? ` · terminó el ${fechaHoraBA(carga.finishedAt)}` : ""} · {n(carga.avance.hechas)} de {n(carga.avance.total)} partes
        </p>
        {carga.errorReason ? (
          <p className="text-[var(--fo-danger)]" role="alert">
            {carga.errorReason}
          </p>
        ) : null}
        {simulacion ? <p className="text-[var(--fo-muted)]">Es una simulación: muestra lo que pasaría, sin cambiar nada.</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th className="py-2 pr-3 font-medium">Parte</th>
              <th className="py-2 pr-3 text-right font-medium">Leídos</th>
              <th className="py-2 pr-3 text-right font-medium">{simulacion ? "Se crearían" : "Creados"}</th>
              <th className="py-2 pr-3 text-right font-medium">{simulacion ? "Se actualizarían" : "Actualizados"}</th>
              <th className="py-2 pr-3 text-right font-medium">Iguales</th>
              <th className="py-2 pr-3 text-right font-medium">Ya existían</th>
              <th className="py-2 pr-3 text-right font-medium">Omitidos</th>
              <th className="py-2 pr-3 text-right font-medium">Conflictos</th>
              <th className="py-2 pr-3 text-right font-medium">Errores</th>
              <th className="py-2 text-right font-medium">Dudas</th>
            </tr>
          </thead>
          <tbody>
            {carga.entities.map((clave) => {
              const e = carga.informe.entidades[clave];
              return (
                <tr key={clave} className="border-t border-[var(--fo-border)] align-top">
                  <td className="py-2 pr-3">{nombres[clave] ?? clave}</td>
                  {e ? (
                    <>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.leidos)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.crear)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.actualizar)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.iguales)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.vinculados)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.omitidos)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(e.conflictos)}</td>
                      <td className={"py-2 pr-3 text-right tabular-nums " + (e.errores > 0 ? "text-[var(--fo-danger)]" : "")}>{n(e.errores)}</td>
                      <td className="py-2 text-right tabular-nums">{n(e.dudas)}</td>
                    </>
                  ) : (
                    <td colSpan={9} className="py-2 text-[var(--fo-muted)]">
                      Todavía no se procesó.
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {carga.entities.map((clave) => {
        const e = carga.informe.entidades[clave];
        if (!e) return null;
        const conMotivos = GRUPOS.filter((g) => Object.keys(e.motivos[g.grupo]).length > 0);
        if (conMotivos.length === 0 && e.fusionados.length === 0) return null;
        return (
          <details key={clave} className="text-sm">
            <summary className="cursor-pointer font-medium">Motivos · {nombres[clave] ?? clave}</summary>
            <div className="mt-2 space-y-2 pl-4">
              {conMotivos.map((g) => (
                <div key={g.grupo}>
                  <p className="text-xs font-medium text-[var(--fo-muted)]">{g.titulo}</p>
                  <ul className="list-disc pl-5">
                    {Object.entries(e.motivos[g.grupo])
                      .sort((a, b) => b[1] - a[1])
                      .map(([motivo, cantidad]) => (
                        <li key={motivo}>
                          {motivo}: {n(cantidad)}
                          {e.ejemplos[motivo]?.length ? <span className="text-xs text-[var(--fo-muted)]"> (ids de Alboom: {e.ejemplos[motivo]!.join(", ")})</span> : null}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              {e.fusionados.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-[var(--fo-muted)]">Duplicados de Alboom fusionados (id fusionado → id que quedó)</p>
                  <p className="text-xs">{e.fusionados.map((f) => `${f.alboomId} → ${f.con}`).join(" · ")}</p>
                </div>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
