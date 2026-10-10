"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archivarGaleriaAction, editarGaleriaAction, publicarGaleriaAction, reactivarGaleriaAction } from "@/app/actions/galerias";
import {
  ETIQUETA_ESTADO_GALERIA, ETIQUETA_MODO_DESCARGA, MAX_MENSAJE_GALERIA, MAX_NOMBRE_GALERIA,
  type EstadoGaleria, type ModoDescarga, type ModoSeleccion,
} from "@/lib/galerias/constantes";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type ConfiguracionVista = {
  nombre: string;
  mensaje: string;
  selectionMode: ModoSeleccion;
  minSelect: number | null;
  maxSelect: number | null;
  allowComments: boolean;
  downloadMode: ModoDescarga;
};

/** Las descargas del original (sólo seleccionadas) llegan con la venta y la entrega; si la galería ya la tiene, se conserva. */
function opcionesDeDescarga(actual: ModoDescarga): ModoDescarga[] {
  return actual === "SELECCIONADAS" ? ["NINGUNA", "VISTA", "SELECCIONADAS"] : ["NINGUNA", "VISTA"];
}

/**
 * Pestaña "Configuración" de la galería: estado (publicar, archivar, reactivar) y los datos que ve el cliente:
 * nombre, mensaje de bienvenida, cómo elige (libre o por cantidad), comentarios y descarga.
 */
export function ConfiguracionGaleria({
  galeriaId, estado, inicial, fotosListas, puedeGestionar,
}: {
  galeriaId: string;
  estado: EstadoGaleria;
  inicial: ConfiguracionVista;
  fotosListas: number;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState({ ...inicial, minSelect: inicial.minSelect?.toString() ?? "", maxSelect: inicial.maxSelect?.toString() ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const bloqueado = !puedeGestionar || pendiente;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await editarGaleriaAction(galeriaId, {
        nombre: v.nombre,
        mensaje: v.mensaje,
        selectionMode: v.selectionMode,
        minSelect: v.selectionMode === "CANTIDAD" ? v.minSelect : null,
        maxSelect: v.selectionMode === "CANTIDAD" ? v.maxSelect : null,
        allowComments: v.allowComments,
        downloadMode: v.downloadMode,
      }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setOk("Guardado.");
      router.refresh();
    });
  }

  function cambiarEstado(accion: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>, confirmacion: string | null, mensaje: string) {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setError(null);
    setOk(null);
    iniciar(async () => {
      const r = await accion(galeriaId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setOk(mensaje);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="estado-galeria-titulo" className="fo-card space-y-3 p-4">
        <h2 id="estado-galeria-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Estado: {ETIQUETA_ESTADO_GALERIA[estado]}
        </h2>
        {estado === "BORRADOR" ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Mientras es un borrador, los clientes no pueden entrar y los enlaces no se pueden compartir. Publicala cuando las fotos estén listas.
            {fotosListas < 1 ? " Primero subí al menos una foto." : ""}
          </p>
        ) : estado === "PUBLICADA" ? (
          <p className="text-sm text-[var(--fo-muted)]">Los clientes con enlace pueden ver las fotos y elegir.</p>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Archivada: los enlaces no abren la galería y no se le pueden subir fotos.</p>
        )}
        {puedeGestionar ? (
          <div className="flex flex-wrap gap-2">
            {estado === "BORRADOR" ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={bloqueado || fotosListas < 1} onClick={() => cambiarEstado(publicarGaleriaAction, null, "Galería publicada. Ahora podés compartir los enlaces desde Clientes.")}>
                Publicar
              </button>
            ) : null}
            {estado === "ARCHIVADA" ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={bloqueado} onClick={() => cambiarEstado(reactivarGaleriaAction, null, "Galería reactivada.")}>
                Reactivar
              </button>
            ) : (
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                disabled={bloqueado}
                onClick={() => cambiarEstado(archivarGaleriaAction, "¿Archivar la galería? Los clientes dejan de poder entrar. Podés reactivarla después.", "Galería archivada.")}
              >
                Archivar
              </button>
            )}
          </div>
        ) : null}
      </section>

      <form onSubmit={guardar} className="space-y-4" aria-label="Configuración de la galería">
        <section className="fo-card space-y-4 p-5" aria-labelledby="datos-galeria-titulo">
          <h2 id="datos-galeria-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Lo que ve el cliente
          </h2>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="gal-nombre">Nombre</label>
            <input id="gal-nombre" className="fo-input" required maxLength={MAX_NOMBRE_GALERIA} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} disabled={bloqueado} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="gal-mensaje">Mensaje de bienvenida</label>
            <textarea id="gal-mensaje" className="fo-input min-h-28" maxLength={MAX_MENSAJE_GALERIA} value={v.mensaje} onChange={(e) => setV({ ...v, mensaje: e.target.value })} disabled={bloqueado} />
            <p className="text-xs text-[var(--fo-muted)]">Se muestra arriba de las fotos. Si lo dejás vacío, no se muestra ninguno.</p>
          </div>
        </section>

        <section className="fo-card space-y-4 p-5" aria-labelledby="seleccion-titulo">
          <h2 id="seleccion-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Cómo elige
          </h2>
          <fieldset className="space-y-2" disabled={bloqueado}>
            <legend className="sr-only">Modo de selección</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="gal-modo" checked={v.selectionMode === "LIBRE"} onChange={() => setV({ ...v, selectionMode: "LIBRE" })} className="mt-1" />
              <span>
                <span className="font-medium">Libre</span>
                <span className="block text-xs text-[var(--fo-muted)]">El cliente elige todas las fotos que quiera.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="gal-modo" checked={v.selectionMode === "CANTIDAD"} onChange={() => setV({ ...v, selectionMode: "CANTIDAD" })} className="mt-1" />
              <span>
                <span className="font-medium">Por cantidad</span>
                <span className="block text-xs text-[var(--fo-muted)]">Hay un mínimo, un máximo o los dos (por ejemplo, las 40 fotos de un fotolibro).</span>
              </span>
            </label>
          </fieldset>
          {v.selectionMode === "CANTIDAD" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="gal-min">Mínimo</label>
                <input id="gal-min" type="number" inputMode="numeric" min={1} step={1} className="fo-input" value={v.minSelect} onChange={(e) => setV({ ...v, minSelect: e.target.value })} disabled={bloqueado} />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="gal-max">Máximo</label>
                <input id="gal-max" type="number" inputMode="numeric" min={1} step={1} className="fo-input" value={v.maxSelect} onChange={(e) => setV({ ...v, maxSelect: e.target.value })} disabled={bloqueado} />
              </div>
              <p className="text-xs text-[var(--fo-muted)] sm:col-span-2">Poné al menos uno. El cliente no puede enviar su selección fuera de ese rango.</p>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.allowComments} onChange={(e) => setV({ ...v, allowComments: e.target.checked })} disabled={bloqueado} />
            El cliente puede dejar comentarios en las fotos
          </label>
          <div className="fo-field-stack max-w-sm">
            <label className="fo-label" htmlFor="gal-descarga">Descarga</label>
            <select id="gal-descarga" className="fo-input" value={v.downloadMode} onChange={(e) => setV({ ...v, downloadMode: e.target.value as ModoDescarga })} disabled={bloqueado}>
              {opcionesDeDescarga(inicial.downloadMode).map((m) => (
                <option key={m} value={m}>{ETIQUETA_MODO_DESCARGA[m]}</option>
              ))}
            </select>
            <p className="text-xs text-[var(--fo-muted)]">“Vista de galería” permite bajar cada foto en tamaño liviano (2048 px), no el original.</p>
          </div>
        </section>

        {puedeGestionar ? (
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={bloqueado}>
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        ) : null}
      </form>

      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {ok}
          </p>
        ) : null}
      </div>
    </div>
  );
}
