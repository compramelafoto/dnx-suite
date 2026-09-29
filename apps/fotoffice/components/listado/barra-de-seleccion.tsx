"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { aplicarLoteAction, prepararLoteAction } from "@/app/actions/listado";
import { useSeleccion, type AccionVisible } from "./seleccion";
import { numero } from "./util";

type Excluido = { id: string; motivo: string };
type Confirmacion = { cantidad: number; mensaje: string; excluidos: Excluido[]; cambio: boolean };
type Final = { aplicados: number; fallidos: { id: string; error: string }[] };

/** "12 quedan afuera: vienen de Cuotas", una línea por motivo. */
function resumirExcluidos(excluidos: Excluido[]): string[] {
  const porMotivo = new Map<string, number>();
  for (const e of excluidos) porMotivo.set(e.motivo, (porMotivo.get(e.motivo) ?? 0) + 1);
  return Array.from(porMotivo, ([motivo, n]) => `${numero(n)} ${n === 1 ? "queda" : "quedan"} afuera: ${motivo}`);
}

/**
 * La barra fija de abajo: aparece con algo seleccionado. Cada acción se hace en dos pasos —el
 * servidor calcula cuántas filas toca y lo muestra; recién al confirmar se aplica— y si en el
 * medio cambió la cantidad, el servidor la devuelve y se pide confirmar otra vez.
 */
export function BarraDeSeleccion() {
  const s = useSeleccion();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [accion, setAccion] = useState<AccionVisible | null>(null);
  const [parametro, setParametro] = useState("");
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [final, setFinal] = useState<Final | null>(null);

  if (s.cantidad === 0 && !final) return null;

  const seleccion = s.todos ? { tipo: "todos" as const, query: s.query } : { tipo: "ids" as const, ids: Array.from(s.ids) };
  const hrefExportar = s.todos
    ? `${s.rutaExportar}${s.query ? `?${s.query}` : ""}`
    : `${s.rutaExportar}?ids=${Array.from(s.ids).map(encodeURIComponent).join(",")}`;

  function cancelar() {
    setAccion(null);
    setParametro("");
    setConfirmacion(null);
    setError(null);
  }

  function elegir(a: AccionVisible) {
    cancelar();
    setFinal(null);
    setAccion(a);
  }

  function continuar() {
    if (!accion) return;
    setError(null);
    startTransition(async () => {
      const r = await prepararLoteAction({ clave: s.clave, accion: accion.clave, seleccion, parametro: accion.parametro ? parametro : null });
      if ("ok" in r && r.ok) setConfirmacion({ cantidad: r.cantidad, mensaje: r.mensaje, excluidos: r.excluidos, cambio: false });
      else setError(r.error);
    });
  }

  function confirmar() {
    if (!accion || !confirmacion) return;
    setError(null);
    startTransition(async () => {
      const r = await aplicarLoteAction({
        clave: s.clave,
        accion: accion.clave,
        seleccion,
        parametro: accion.parametro ? parametro : null,
        cantidadConfirmada: confirmacion.cantidad,
      });
      if (!("estado" in r) || r.estado === "error") {
        setError(r.error);
        return;
      }
      if (r.estado === "reconfirmar") {
        setConfirmacion({ cantidad: r.cantidad, mensaje: r.mensaje, excluidos: r.excluidos, cambio: true });
        return;
      }
      cancelar();
      s.limpiar();
      setFinal({ aplicados: r.resultado.aplicados, fallidos: r.resultado.fallidos });
      router.refresh();
    });
  }

  return (
    <>
      {/* Deja lugar para que la barra no tape las últimas filas. */}
      <div aria-hidden className="h-28" />
      <div className="fo-card fixed inset-x-0 bottom-0 z-30 rounded-none border-x-0 border-b-0 !p-4" role="region" aria-label="Acciones sobre la selección">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          {final ? (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
              <span className="font-medium text-[var(--fo-text)]">
                Listo: {numero(final.aplicados)} {final.aplicados === 1 ? "actualizado" : "actualizados"}
                {final.fallidos.length ? `, ${numero(final.fallidos.length)} no se ${final.fallidos.length === 1 ? "pudo" : "pudieron"}` : ""}
              </span>
              {final.fallidos.length ? (
                <details className="text-[var(--fo-muted)]">
                  <summary className="cursor-pointer underline">ver detalle</summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto">
                    {final.fallidos.map((f) => (
                      <li key={f.id}>{f.error}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <button type="button" className="fo-icon-btn ml-auto" aria-label="Cerrar aviso" onClick={() => setFinal(null)}>
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {s.cantidad > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-medium text-[var(--fo-text)]">
                {s.todos ? `Los ${numero(s.cantidad)} resultados` : `${numero(s.cantidad)} ${s.cantidad === 1 ? "seleccionado" : "seleccionados"}`}
              </span>
              {s.acciones.map((a) => (
                <button
                  key={a.clave}
                  type="button"
                  className={`fo-btn ${accion?.clave === a.clave ? "fo-btn-primary" : "fo-btn-secondary"}`}
                  disabled={pendiente}
                  onClick={() => elegir(a)}
                >
                  {a.etiqueta}
                </button>
              ))}
              {s.puedeExportar ? (
                <a className="fo-btn fo-btn-secondary" href={hrefExportar}>
                  <Download className="size-4" aria-hidden />
                  Exportar selección
                </a>
              ) : null}
              <button type="button" className="fo-btn fo-btn-ghost ml-auto" onClick={() => {
                  cancelar();
                  s.limpiar();
                }}>
                Quitar selección
              </button>
            </div>
          ) : null}

          {accion && !confirmacion ? (
            <div className="flex flex-wrap items-end gap-2">
              {accion.parametro ? (
                <label className="flex min-w-56 flex-col gap-1 text-sm">
                  <span className="fo-label">{accion.parametro.etiqueta}</span>
                  <select className="fo-input" value={parametro} onChange={(e) => setParametro(e.target.value)}>
                    <option value="">Elegí una opción</option>
                    {accion.parametro.opciones.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="fo-btn fo-btn-primary"
                disabled={pendiente || (accion.parametro !== null && !parametro)}
                onClick={continuar}
              >
                Continuar
              </button>
              <button type="button" className="fo-btn fo-btn-ghost" onClick={cancelar}>
                Cancelar
              </button>
            </div>
          ) : null}

          {confirmacion ? (
            <div className="flex flex-col gap-2 text-sm" role="alert">
              {confirmacion.cambio ? (
                <p className="text-[var(--fo-warning)]">La cantidad cambió mientras tanto. Revisá y confirmá de nuevo.</p>
              ) : null}
              <p className="text-[var(--fo-text)]">{confirmacion.mensaje}</p>
              {resumirExcluidos(confirmacion.excluidos).map((l) => (
                <p key={l} className="fo-helper">
                  {l}
                </p>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="fo-btn fo-btn-primary"
                  disabled={pendiente || confirmacion.cantidad === 0}
                  onClick={confirmar}
                >
                  Confirmar
                </button>
                <button type="button" className="fo-btn fo-btn-ghost" onClick={cancelar}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
