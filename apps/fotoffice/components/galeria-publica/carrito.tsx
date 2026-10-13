"use client";

import { useEffect, useRef } from "react";
import { formatearCentavos, textoFaltanParaPaquete, type Carrito } from "@/lib/galerias/precios";
import { textoFotosExtra } from "@/lib/galerias/venta-publica";

/**
 * El carrito de las fotos extra: cuántas fotos se cobran, el aviso del último paquete, el descuento y el total.
 * Lo que se muestra es una cuenta del navegador con las mismas reglas; el importe que se cobra lo vuelve a
 * calcular el servidor al abrir el pago.
 */
export function CarritoExtras({
  carrito,
  pagando,
  error,
  onPagar,
  onCerrar,
}: {
  carrito: Carrito;
  pagando: boolean;
  error: string | null;
  onPagar: () => void;
  onCerrar: () => void;
}) {
  const principal = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    principal.current?.focus();
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const extras = carrito.extras.length;
  const faltan = textoFaltanParaPaquete(carrito.fotosQueFaltanParaPaquete);
  const regla = carrito.reglaAplicada;
  return (
    <div role="dialog" aria-modal="true" aria-label="Fotos extra" className="fixed inset-0 z-50 overflow-y-auto bg-white text-[var(--fo-text)]">
      <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-12 md:py-10">
        <h2 className="text-2xl font-semibold">Tus fotos extra</h2>
        {extras === 0 ? (
          <p>No tenés fotos extra para pagar.</p>
        ) : (
          <>
            <p className="text-lg">
              Elegiste <strong>{textoFotosExtra(extras)}</strong>
              {carrito.incluidas.length > 0 ? <span className="text-sm opacity-70"> (más {carrito.incluidas.length === 1 ? "1 incluida" : `${carrito.incluidas.length} incluidas`} sin costo)</span> : null}.
            </p>
            {carrito.paquetes !== null ? (
              <p className="text-sm opacity-80">{carrito.paquetes === 1 ? "1 paquete" : `${carrito.paquetes} paquetes`}.</p>
            ) : null}
            {faltan ? <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">{faltan}</p> : null}
            <dl className="space-y-1 border-y py-3 text-base">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatearCentavos(carrito.subtotalCents)}</dd></div>
              {carrito.descuentoCents > 0 ? (
                <div className="flex justify-between text-green-800">
                  <dt>Descuento{regla ? ` (${regla.pct}%)` : ""}</dt>
                  <dd>- {formatearCentavos(carrito.descuentoCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{formatearCentavos(carrito.totalCents)}</dd></div>
            </dl>
            <p className="text-sm opacity-70">Pagás con Mercado Pago. Cuando se acredita, las fotos quedan como compradas.</p>
          </>
        )}
        {error ? <p role="alert" className="fo-alert-error">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCerrar} disabled={pagando} className="fo-btn fo-btn-secondary">Volver a la galería</button>
          {extras > 0 ? (
            <button ref={principal} type="button" onClick={onPagar} disabled={pagando} className="fo-btn fo-btn-primary">
              {pagando ? "Abriendo el pago…" : `Pagar ${formatearCentavos(carrito.totalCents)}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
