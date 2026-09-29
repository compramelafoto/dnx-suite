"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { aplicarLoteAction, prepararLoteAction } from "@/app/actions/listado";
import { useSeleccion, type AccionVisible } from "./seleccion";
import { armarSeleccion, firmaSeleccion, numero, type SeleccionLote } from "./util";

type Excluido = { id: string; motivo: string };
/**
 * Lo que el servidor calculó, junto con la selección y el parámetro con que lo calculó: "Confirmar"
 * manda exactamente eso, no lo que esté tildado en ese momento.
 */
type Confirmacion = {
  cantidad: number;
  mensaje: string;
  excluidos: Excluido[];
  cambio: boolean;
  seleccion: SeleccionLote;
  parametro: string | null;
  firma: string;
};
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

  const seleccion = armarSeleccion(s.todos, s.ids, s.query);
  // Si después de "Continuar" se tildó o destildó algo, lo calculado ya no vale: hay que recalcular.
  const vigente = confirmacion && confirmacion.firma === firmaSeleccion(seleccion) ? confirmacion : null;
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
    const congelada = seleccion;
    const param = accion.parametro ? parametro : null;
    startTransition(async () => {
      const r = await prepararLoteAction({ clave: s.clave, accion: accion.clave, seleccion: congelada, parametro: param });
      if ("ok" in r && r.ok) {
        setConfirmacion({
          cantidad: r.cantidad,
          mensaje: r.mensaje,
          excluidos: r.excluidos,
          cambio: false,
          seleccion: congelada,
          parametro: param,
          firma: firmaSeleccion(congelada),
        });
      }
      else setError(r.error);
    });
  }

  function confirmar() {
    if (!accion || !vigente) return;
    const previa = vigente;
    setError(null);
    startTransition(async () => {
      const r = await aplicarLoteAction({
        clave: s.clave,
        accion: accion.clave,
        seleccion: previa.seleccion,
        parametro: previa.parametro,
        cantidadConfirmada: previa.cantidad,
      });
      if (!("estado" in r) || r.estado === "error") {
        setError(r.error);
        return;
      }
      if (r.estado === "reconfirmar") {
        setConfirmacion({ ...previa, cantidad: r.cantidad, mensaje: r.mensaje, excluidos: r.excluidos, cambio: true });
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

          {accion && !vigente ? (
            <div className="flex flex-wrap items-end gap-2">
              {confirmacion ? (
                <p className="w-full text-sm text-[var(--fo-warning)]">Cambiaste la selección: tocá Continuar para recalcular.</p>
              ) : null}
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

          {vigente ? (
            <div className="flex flex-col gap-2 text-sm" role="alert">
              {vigente.cambio ? (
                <p className="text-[var(--fo-warning)]">La cantidad cambió mientras tanto. Revisá y confirmá de nuevo.</p>
              ) : null}
              <p className="text-[var(--fo-text)]">{vigente.mensaje}</p>
              {resumirExcluidos(vigente.excluidos).map((l) => (
                <p key={l} className="fo-helper">
                  {l}
                </p>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="fo-btn fo-btn-primary"
                  disabled={pendiente || vigente.cantidad === 0}
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
