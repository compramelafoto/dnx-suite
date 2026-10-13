"use client";

import { useState, useTransition } from "react";
import { guardarAjustesGaleriaAction } from "@/app/actions/galerias";
import { ETIQUETA_MODO_DESCARGA, MAX_MENSAJE_GALERIA, type ModoDescarga } from "@/lib/galerias/constantes";

type Inicial = { defaultMessage: string; defaultAllowComments: boolean; defaultDownloadMode: ModoDescarga; defaultIncomeCategoryId: string };

/** Mensaje de bienvenida, comentarios y descarga por omisión de las galerías nuevas, y el rubro de ingreso de las ventas de fotos extra. */
export function AjustesForm({ inicial, rubros }: { inicial: Inicial; rubros: { id: string; nombre: string }[] }) {
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        const r = await guardarAjustesGaleriaAction({
          defaultMessage: v.defaultMessage,
          defaultAllowComments: v.defaultAllowComments,
          defaultDownloadMode: v.defaultDownloadMode,
          defaultIncomeCategoryId: v.defaultIncomeCategoryId,
        });
        if (!r.ok) return setError(r.error);
        setOk("Guardado. Vale para las galerías que crees de ahora en adelante.");
      } catch {
        setError("No pudimos guardar los cambios. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-6" aria-label="Ajustes de galerías">
      <section className="fo-card space-y-4 p-5" aria-labelledby="gal-ajustes-bienvenida">
        <div className="space-y-1">
          <h2 id="gal-ajustes-bienvenida" className="text-base font-semibold">
            Mensaje de bienvenida
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">Se muestra arriba de las fotos cuando el cliente abre su enlace. Si lo dejás vacío, las galerías nuevas no llevan mensaje.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="gal-ajustes-mensaje">Texto</label>
          <textarea id="gal-ajustes-mensaje" className="fo-input min-h-32" maxLength={MAX_MENSAJE_GALERIA} value={v.defaultMessage} onChange={(e) => setV({ ...v, defaultMessage: e.target.value })} />
        </div>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="gal-ajustes-opciones">
        <div className="space-y-1">
          <h2 id="gal-ajustes-opciones" className="text-base font-semibold">
            Cómo eligen los clientes
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            La selección nace libre (el cliente elige las fotos que quiera). Si una galería necesita una cantidad exacta, por ejemplo la de un fotolibro, se define en esa galería.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.defaultAllowComments} onChange={(e) => setV({ ...v, defaultAllowComments: e.target.checked })} />
          El cliente puede dejar comentarios en las fotos
        </label>
        <div className="fo-field-stack max-w-sm">
          <label className="fo-label" htmlFor="gal-ajustes-descarga">Descarga</label>
          <select id="gal-ajustes-descarga" className="fo-input" value={v.defaultDownloadMode} onChange={(e) => setV({ ...v, defaultDownloadMode: e.target.value as ModoDescarga })}>
            <option value="NINGUNA">{ETIQUETA_MODO_DESCARGA.NINGUNA}</option>
            <option value="VISTA">{ETIQUETA_MODO_DESCARGA.VISTA}</option>
            <option value="SELECCIONADAS">{ETIQUETA_MODO_DESCARGA.SELECCIONADAS}</option>
          </select>
          <p className="text-xs text-[var(--fo-muted)]">“Vista de galería” deja bajar cada foto en tamaño liviano (2048 px), no el original. “Sólo las fotos elegidas o compradas, en alta” entrega el original de las que el cliente pagó y, una vez enviada la selección, de las que elegió dentro de lo incluido.</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="gal-ajustes-ventas">
        <div className="space-y-1">
          <h2 id="gal-ajustes-ventas" className="text-base font-semibold">
            Venta de fotos extra
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Cuando un cliente paga fotos extra, el ingreso se anota en Caja. Elegí el rubro de ingreso con el que se anota por omisión; cada galería puede usar otro.
          </p>
        </div>
        <div className="fo-field-stack max-w-sm">
          <label className="fo-label" htmlFor="gal-ajustes-rubro">Rubro de ingreso por omisión</label>
          <select id="gal-ajustes-rubro" className="fo-input" value={v.defaultIncomeCategoryId} onChange={(e) => setV({ ...v, defaultIncomeCategoryId: e.target.value })}>
            <option value="">Sin rubro</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="space-y-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p>
          ) : ok ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">{ok}</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
