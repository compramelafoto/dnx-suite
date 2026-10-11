"use client";

import { useState, useTransition } from "react";
import { guardarAjustesGaleriaAction } from "@/app/actions/galerias";
import { ETIQUETA_MODO_DESCARGA, MAX_MENSAJE_GALERIA, type ModoDescarga } from "@/lib/galerias/constantes";

type Inicial = { defaultMessage: string; defaultAllowComments: boolean; defaultDownloadMode: ModoDescarga };

/** Mensaje de bienvenida, comentarios y descarga por omisión de las galerías nuevas. */
export function AjustesForm({ inicial }: { inicial: Inicial }) {
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
          </select>
          <p className="text-xs text-[var(--fo-muted)]">“Vista de galería” deja bajar cada foto en tamaño liviano (2048 px), no el original.</p>
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
