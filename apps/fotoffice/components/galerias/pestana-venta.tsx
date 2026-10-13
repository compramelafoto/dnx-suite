"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { guardarVentaGaleriaAction } from "@/app/actions/galerias";
import { InputMoneda } from "@/components/campos/input-moneda";
import { MODOS_VENTA, type ModoVenta } from "@/lib/galerias/constantes";
import { MAX_REGLAS_DESCUENTO, textoFaltanParaPaquete } from "@/lib/galerias/precios";
import {
  AYUDA_MODO_VENTA, EJEMPLO_IMPORTE, ETIQUETA_MODO_DESCUENTO, ETIQUETA_MODO_PRECIO, ETIQUETA_MODO_VENTA,
  aConfigVenta, ejemplosDeCarrito, formatearCentavos, type FormularioVenta,
} from "@/lib/galerias/venta-form";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type RubroVista = { id: string; nombre: string };

/**
 * Pestaña "Venta" de la galería: cómo se cobran las fotos extra (modo de venta, fotos incluidas, precio por
 * foto o por paquete, descuentos y rubro de ingreso) con una vista previa del carrito para 1, 5 y 20 extras.
 * El servidor vuelve a validar todo al guardar y calcula siempre el precio que se cobra. Cambiar los precios
 * no modifica las compras que ya se hicieron.
 */
export function PestanaVenta({
  galeriaId, inicial, rubros, rubroPorOmision, puedeGestionar,
}: {
  galeriaId: string;
  inicial: FormularioVenta;
  rubros: RubroVista[];
  rubroPorOmision: string | null;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState<FormularioVenta>(inicial);
  const [errores, setErrores] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const bloqueado = !puedeGestionar || pendiente;
  const modo = (MODOS_VENTA as readonly string[]).includes(v.saleMode) ? (v.saleMode as ModoVenta) : "SELECCION";
  const hayVenta = modo !== "SELECCION";

  const resultado = useMemo(() => aConfigVenta(v), [v]);
  const ejemplos = useMemo(() => (resultado.ok ? ejemplosDeCarrito(resultado.config) : []), [resultado]);

  function cambiar(parcial: Partial<FormularioVenta>) {
    setV((x) => ({ ...x, ...parcial }));
    setOk(null);
  }

  function cambiarRegla(i: number, parcial: Partial<{ pct: string; desde: string }>) {
    cambiar({ reglas: v.reglas.map((r, j) => (j === i ? { ...r, ...parcial } : r)) });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrores([]);
    setOk(null);
    iniciar(async () => {
      const r = await guardarVentaGaleriaAction(galeriaId, v).catch(() => ({ ok: false as const, error: ERROR_CONEXION, errores: undefined }));
      if (!r.ok) return setErrores(r.errores && r.errores.length > 0 ? r.errores : [r.error]);
      setOk("Guardado. Vale para las compras que se hagan de ahora en adelante.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-4" aria-label="Venta de fotos extra">
      <section className="fo-card space-y-4 p-5" aria-labelledby="venta-modo-titulo">
        <h2 id="venta-modo-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Modo de venta
        </h2>
        <fieldset className="space-y-2" disabled={bloqueado}>
          <legend className="sr-only">Modo de venta</legend>
          {MODOS_VENTA.map((m) => (
            <label key={m} className="flex items-start gap-2 text-sm">
              <input type="radio" name="venta-modo" checked={modo === m} onChange={() => cambiar({ saleMode: m })} className="mt-1" />
              <span>
                <span className="font-medium">{ETIQUETA_MODO_VENTA[m]}</span>
                <span className="block text-xs text-[var(--fo-muted)]">{AYUDA_MODO_VENTA[m]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {modo === "SELECCION_Y_VENTA" ? (
          <div className="fo-field-stack max-w-xs">
            <label className="fo-label" htmlFor="venta-incluidas">Fotos incluidas sin costo</label>
            <input id="venta-incluidas" className="fo-input" inputMode="numeric" maxLength={6} value={v.includedCount} onChange={(e) => cambiar({ includedCount: e.target.value })} disabled={bloqueado} />
            <p className="text-xs text-[var(--fo-muted)]">Las primeras fotos que el cliente elija van incluidas; las demás se cobran. Con 0, todas se cobran.</p>
          </div>
        ) : null}
      </section>

      {hayVenta ? (
        <>
          <section className="fo-card space-y-4 p-5" aria-labelledby="venta-precio-titulo">
            <h2 id="venta-precio-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Precio
            </h2>
            <div className="fo-field-stack max-w-xs">
              <label className="fo-label" htmlFor="venta-precio-modo">Cómo se cobra</label>
              <select id="venta-precio-modo" className="fo-input" value={v.pricingMode} onChange={(e) => cambiar({ pricingMode: e.target.value })} disabled={bloqueado}>
                <option value="">Elegí una opción</option>
                <option value="POR_FOTO">{ETIQUETA_MODO_PRECIO.POR_FOTO}</option>
                <option value="PAQUETE">{ETIQUETA_MODO_PRECIO.PAQUETE}</option>
              </select>
            </div>
            {v.pricingMode === "POR_FOTO" ? (
              <div className="fo-field-stack max-w-xs">
                <label className="fo-label" htmlFor="venta-precio-foto">Precio por foto</label>
                <InputMoneda id="venta-precio-foto" envio="coma" maxLength={20} placeholder={EJEMPLO_IMPORTE} value={v.unitPrice} onChange={(valor) => cambiar({ unitPrice: valor })} disabled={bloqueado} />
              </div>
            ) : null}
            {v.pricingMode === "PAQUETE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="venta-paquete-tam">Fotos por paquete</label>
                  <input id="venta-paquete-tam" className="fo-input" inputMode="numeric" maxLength={6} placeholder="Ej.: 10" value={v.packageSize} onChange={(e) => cambiar({ packageSize: e.target.value })} disabled={bloqueado} />
                </div>
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="venta-paquete-precio">Precio del paquete</label>
                  <InputMoneda id="venta-paquete-precio" envio="coma" maxLength={20} placeholder={EJEMPLO_IMPORTE} value={v.packagePrice} onChange={(valor) => cambiar({ packagePrice: valor })} disabled={bloqueado} />
                </div>
                <p className="text-xs text-[var(--fo-muted)] sm:col-span-2">Las fotos extra se agrupan en paquetes; el último se cobra entero y el cliente ve cuántas fotos más entran sin costo.</p>
              </div>
            ) : null}
          </section>

          <section className="fo-card space-y-4 p-5" aria-labelledby="venta-descuento-titulo">
            <h2 id="venta-descuento-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Descuento
            </h2>
            <div className="fo-field-stack max-w-xs">
              <label className="fo-label" htmlFor="venta-descuento-modo">Descuento</label>
              <select id="venta-descuento-modo" className="fo-input" value={v.discountMode} onChange={(e) => cambiar({ discountMode: e.target.value })} disabled={bloqueado}>
                <option value="NINGUNO">Ninguno</option>
                <option value="UNICO">Único (un porcentaje fijo)</option>
                <option value="PROGRESIVO">Progresivo (según la cantidad)</option>
              </select>
            </div>
            {v.discountMode === "UNICO" ? (
              <div className="fo-field-stack max-w-xs">
                <label className="fo-label" htmlFor="venta-descuento-pct">Porcentaje de descuento</label>
                <input id="venta-descuento-pct" className="fo-input" inputMode="numeric" maxLength={3} placeholder="Ej.: 10" value={v.discountPct} onChange={(e) => cambiar({ discountPct: e.target.value })} disabled={bloqueado} />
                <p className="text-xs text-[var(--fo-muted)]">Entre 1 y 90 %. Se descuenta del total de las fotos extra.</p>
              </div>
            ) : null}
            {v.discountMode === "PROGRESIVO" ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--fo-muted)]">
                  Cada regla dice “X % desde N fotos”. Se aplica la de mayor cantidad que el cliente alcance, contando sólo las fotos extra de esa compra
                  (por paquete, las fotos de los paquetes). Hasta {MAX_REGLAS_DESCUENTO} reglas.
                </p>
                <ul className="space-y-2">
                  {v.reglas.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-end gap-2">
                      <div className="fo-field-stack w-24">
                        <label className="fo-label" htmlFor={`venta-regla-pct-${i}`}>Descuento (%)</label>
                        <input id={`venta-regla-pct-${i}`} className="fo-input" inputMode="numeric" maxLength={3} value={r.pct} onChange={(e) => cambiarRegla(i, { pct: e.target.value })} disabled={bloqueado} />
                      </div>
                      <div className="fo-field-stack w-28">
                        <label className="fo-label" htmlFor={`venta-regla-desde-${i}`}>Desde (fotos)</label>
                        <input id={`venta-regla-desde-${i}`} className="fo-input" inputMode="numeric" maxLength={4} value={r.desde} onChange={(e) => cambiarRegla(i, { desde: e.target.value })} disabled={bloqueado} />
                      </div>
                      <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={bloqueado} onClick={() => cambiar({ reglas: v.reglas.filter((_, j) => j !== i) })}>
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
                {v.reglas.length < MAX_REGLAS_DESCUENTO ? (
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={bloqueado} onClick={() => cambiar({ reglas: [...v.reglas, { pct: "", desde: "" }] })}>
                    Agregar regla
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="fo-card space-y-3 p-5" aria-labelledby="venta-rubro-titulo">
            <h2 id="venta-rubro-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Rubro de ingreso en Caja
            </h2>
            <div className="fo-field-stack max-w-sm">
              <label className="fo-label" htmlFor="venta-rubro">Rubro</label>
              <select id="venta-rubro" className="fo-input" value={v.incomeCategoryId} onChange={(e) => cambiar({ incomeCategoryId: e.target.value })} disabled={bloqueado}>
                <option value="">{rubroPorOmision ? `El de Configuración → Galería (${rubroPorOmision})` : "Sin rubro"}</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--fo-muted)]">En qué rubro de ingreso de Caja se anotan las ventas de esta galería. Si lo dejás vacío se usa el de Configuración → Galería.</p>
            </div>
          </section>

          <section className="fo-card space-y-3 p-5" aria-labelledby="venta-previa-titulo">
            <h2 id="venta-previa-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Así se ve el carrito
            </h2>
            {resultado.ok && ejemplos.length > 0 ? (
              <>
                <p className="text-xs text-[var(--fo-muted)]">Lo que pagaría un cliente que elige las fotos incluidas y suma 1, 5 o 20 fotos extra.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--fo-muted)]">
                        <th scope="col" className="py-1 pr-3 font-medium">Fotos extra</th>
                        <th scope="col" className="py-1 pr-3 text-right font-medium">Subtotal</th>
                        <th scope="col" className="py-1 pr-3 text-right font-medium">Descuento</th>
                        <th scope="col" className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ejemplos.map((e) => (
                        <tr key={e.extras} className="border-t border-[var(--fo-border)] align-top">
                          <td className="py-1.5 pr-3">
                            {e.extras} {e.extras === 1 ? "foto" : "fotos"}
                            {e.carrito.paquetes !== null ? <span className="block text-xs text-[var(--fo-muted)]">{e.carrito.paquetes} {e.carrito.paquetes === 1 ? "paquete" : "paquetes"}</span> : null}
                            {textoFaltanParaPaquete(e.carrito.fotosQueFaltanParaPaquete) ? <span className="block text-xs text-[var(--fo-muted)]">{textoFaltanParaPaquete(e.carrito.fotosQueFaltanParaPaquete)}</span> : null}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{formatearCentavos(e.subtotalCents)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {e.descuentoCents > 0 ? `− ${formatearCentavos(e.descuentoCents)}` : "—"}
                            {e.descuento ? <span className="block text-xs text-[var(--fo-muted)]">{e.descuento}</span> : null}
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatearCentavos(e.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">Completá el precio para ver cuánto pagaría un cliente.</p>
            )}
          </section>
        </>
      ) : null}

      {puedeGestionar ? (
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={bloqueado}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      ) : (
        <p className="text-xs text-[var(--fo-muted)]">Para cambiar la venta necesitás permiso de Gestionar en Galería.</p>
      )}

      <div aria-live="polite">
        {errores.length > 0 ? (
          <ul role="alert" className="list-inside list-disc space-y-0.5 text-sm text-[var(--fo-danger)]">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {ok}
          </p>
        ) : null}
      </div>
    </form>
  );
}
