import type { Descuento } from "@/lib/presupuestos/constantes";
import type { CostosVersion } from "@/lib/presupuestos/costos";
import { pesos } from "@/lib/presupuestos/editor";
import type { TotalesPresupuesto } from "@/lib/presupuestos/totales";

/**
 * Una versión ENVIADA, sólo para leer (las enviadas no se editan: "Editar" crea la siguiente).
 * Costo y margen sólo si la página los pasó (`costos`), que sólo pasa con `configurar` (R4).
 */
type ItemVista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: Descuento | null;
  modoPrecio: "LISTA" | "CALCULO";
  seccion: string | null;
  opcional: boolean;
};

export function VistaPresupuesto({
  items,
  totales,
  condiciones,
  propuestaPago,
  costos,
}: {
  items: readonly ItemVista[];
  totales: TotalesPresupuesto;
  condiciones: string | null;
  propuestaPago: string | null;
  costos?: CostosVersion | null;
}) {
  const secciones: (string | null)[] = [];
  for (const i of items) if (!secciones.includes(i.seccion)) secciones.push(i.seccion);
  return (
    <div className="space-y-6">
      <section aria-label="Ítems" className="fo-card space-y-4 overflow-x-auto">
        {items.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Esta versión no tiene ítems.</p> : null}
        {secciones.map((sec) => (
          <div key={sec ?? "__sin__"} className="space-y-2">
            {sec !== null || secciones.length > 1 ? <h3 className="text-sm font-semibold text-[var(--fo-text)]">{sec ?? "Sin sección"}</h3> : null}
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fo-muted)]">
                  <th className="py-1 pr-2 font-medium">Ítem</th>
                  <th className="py-1 pr-2 text-right font-medium">Cant.</th>
                  <th className="py-1 pr-2 text-right font-medium">Precio unit.</th>
                  <th className="py-1 pr-2 text-right font-medium">Descuento</th>
                  <th className="py-1 pr-2 text-right font-medium">Neto</th>
                  {costos ? <th className="py-1 pr-2 text-right font-medium">Costo</th> : null}
                  {costos ? <th className="py-1 text-right font-medium">Margen</th> : null}
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => i.seccion === sec)
                  .map((i) => {
                    const c = costos?.porItem[i.id];
                    return (
                      <tr key={i.id} className="border-t border-[var(--fo-border)] align-top">
                        <td className="py-2 pr-2">
                          <span className="font-medium text-[var(--fo-text)]">{i.nombre}</span>
                          {i.opcional ? <span className="ml-2 text-xs text-[var(--fo-muted)]">(opcional)</span> : null}
                          {i.modoPrecio === "CALCULO" ? <span className="ml-2 text-xs text-[var(--fo-muted)]">· ¿Cuánto Cobro?</span> : null}
                          {i.descripcion ? <span className="block text-xs text-[var(--fo-muted)]">{i.descripcion}</span> : null}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{i.cantidad}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{pesos(i.precioUnitario)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {i.descuento ? (i.descuento.tipo === "PORCENTAJE" ? `${i.descuento.valor} %` : pesos(i.descuento.valor)) : "—"}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{pesos(totales.renglones[i.id]?.neto ?? 0)}</td>
                        {costos ? <td className="py-2 pr-2 text-right tabular-nums">{c && c.costo !== null ? pesos(c.costo) : "—"}</td> : null}
                        {costos ? <td className="py-2 text-right tabular-nums">{c && c.margen !== null ? pesos(c.margen) : "—"}</td> : null}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Condiciones" className="fo-card space-y-3 text-sm">
          <div>
            <h3 className="text-xs text-[var(--fo-muted)]">Condiciones</h3>
            <p className="whitespace-pre-line">{condiciones || "—"}</p>
          </div>
          <div>
            <h3 className="text-xs text-[var(--fo-muted)]">Propuesta de pago</h3>
            <p className="whitespace-pre-line">{propuestaPago || "—"}</p>
          </div>
        </section>
        <section aria-label="Totales" className="fo-card space-y-2 text-sm">
          <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Subtotal</span><span className="tabular-nums">{pesos(totales.subtotal)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Descuentos</span><span className="tabular-nums">−{pesos(totales.descuentoItems + totales.descuentoGlobal)}</span></div>
          <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{pesos(totales.total)}</span></div>
          {totales.opcionales.cantidad > 0 ? (
            <div className="flex justify-between gap-2 text-[var(--fo-muted)]"><span>Opcionales (aparte)</span><span className="tabular-nums">{pesos(totales.opcionales.total)}</span></div>
          ) : null}
          {costos ? (
            <div className="space-y-1 border-t border-[var(--fo-border)] pt-2">
              <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Costo conocido</span><span className="tabular-nums">{pesos(costos.costoTotal)}</span></div>
              <div className="flex justify-between gap-2 font-medium"><span>Margen</span><span className="tabular-nums">{pesos(costos.margen)}</span></div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
