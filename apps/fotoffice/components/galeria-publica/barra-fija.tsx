"use client";

import type { FiltroGaleria } from "@/lib/galerias/publico-tipos";

export type PropsBarra = {
  filtro: FiltroGaleria;
  onFiltro: (f: FiltroGaleria) => void;
  cantidades: { todas: number; seleccionadas: number; conComentarios: number };
  mostrarComentarios: boolean;
  /** "12" o "12 de 20". */
  contador: string;
  /** "Mínimo 10" / "Máximo 20" / "Entre 10 y 20", o null. */
  requisito: string | null;
  cumpleMinimo: boolean;
  editable: boolean;
  /** Texto de sólo lectura (ya enviada). */
  textoLectura: string | null;
  onEnviar: () => void;
  /** Galería con venta: el carrito en la barra. null si no hay venta. */
  venta?: {
    /** "Sólo venta": no hay «Enviar selección». */
    soloVenta: boolean;
    extras: number;
    /** «3 extra · $ 4.500,00». */
    textoExtras: string;
    onPagar: () => void;
  } | null;
};

/** Barra fija abajo: filtros, contador de elegidas y "Enviar selección" siempre a mano. */
export function BarraFija(p: PropsBarra) {
  const chip = (valor: FiltroGaleria, etiqueta: string, n: number) => (
    <button
      key={valor}
      type="button"
      onClick={() => p.onFiltro(valor)}
      aria-pressed={p.filtro === valor}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
        p.filtro === valor ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white" : "border-[var(--fo-border-strong)] bg-white text-[var(--fo-text-secondary)]"
      }`}
    >
      {etiqueta} ({n})
    </button>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--fo-border-strong)] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto max-w-6xl space-y-2 px-3 py-2">
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar fotos">
          {chip("TODAS", "Todas", p.cantidades.todas)}
          {chip("SELECCIONADAS", "Seleccionadas", p.cantidades.seleccionadas)}
          {p.mostrarComentarios ? chip("CON_COMENTARIOS", "Con comentarios", p.cantidades.conComentarios) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            {p.editable ? (
              <>
                <p className="font-semibold" aria-live="polite">
                  {p.contador} {p.venta?.soloVenta ? "para comprar" : p.contador === "1" ? "seleccionada" : "seleccionadas"}
                </p>
                {p.venta && p.venta.extras > 0 ? <p className="text-xs font-medium">{p.venta.textoExtras}</p> : null}
                {p.requisito ? <p className={`text-xs ${p.cumpleMinimo ? "opacity-70" : "text-amber-700"}`}>{p.requisito}</p> : null}
              </>
            ) : (
              <p className="opacity-80">{p.textoLectura}</p>
            )}
          </div>
          {p.editable ? (
            <div className="flex shrink-0 gap-2">
              {p.venta && p.venta.extras > 0 ? (
                <button type="button" onClick={p.venta.onPagar} className="fo-btn fo-btn-primary">
                  Pagar fotos extra
                </button>
              ) : null}
              {!p.venta?.soloVenta ? (
                <button
                  type="button"
                  onClick={p.onEnviar}
                  disabled={p.cantidades.seleccionadas === 0}
                  className={p.venta && p.venta.extras > 0 ? "fo-btn fo-btn-secondary" : "fo-btn fo-btn-primary"}
                >
                  Enviar selección
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
