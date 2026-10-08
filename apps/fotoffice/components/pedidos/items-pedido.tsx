import type { Descuento } from "@/lib/presupuestos/constantes";
import type { CostosVersion } from "@/lib/presupuestos/costos";
import type { TotalesPresupuesto } from "@/lib/presupuestos/totales";
import { pesosPedido } from "@/lib/pedidos/pantalla";

/** Un renglón del pedido, sin datos internos. */
export type ItemDePedido = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: Descuento | null;
  opcional: boolean;
};

/** Saca de un ítem guardado sólo lo que se muestra (nunca la instantánea del cálculo). */
export function aItemDePedido(i: ItemDePedido): ItemDePedido {
  return {
    id: i.id,
    nombre: i.nombre,
    descripcion: i.descripcion,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    descuento: i.descuento ? { ...i.descuento } : null,
    opcional: i.opcional,
  };
}

/**
 * Ítems y totales del pedido (la instantánea que se confirmó). Componente de servidor. Costo y
 * margen sólo si la página los pasó (`costos`), que sólo pasa con `configurar` o `verDinero`.
 */
export function ItemsPedido({
  items,
  totales,
  costos,
}: {
  items: readonly ItemDePedido[];
  totales: TotalesPresupuesto | null;
  costos: CostosVersion | null;
}) {
  return (
    <section aria-labelledby="items-titulo" className="fo-card space-y-3 overflow-x-auto">
      <h2 id="items-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Ítems
      </h2>
      {items.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">El pedido no tiene ítems.</p> : null}
      {items.length > 0 ? (
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th className="py-1 pr-2 font-medium">Ítem</th>
              <th className="py-1 pr-2 text-right font-medium">Cant.</th>
              <th className="py-1 pr-2 text-right font-medium">Precio unit.</th>
              <th className="py-1 pr-2 text-right font-medium">Neto</th>
              {costos ? <th className="py-1 pr-2 text-right font-medium">Costo</th> : null}
              {costos ? <th className="py-1 text-right font-medium">Margen</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const c = costos?.porItem[i.id];
              return (
                <tr key={i.id} className="border-t border-[var(--fo-border)] align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium text-[var(--fo-text)]">{i.nombre}</span>
                    {i.opcional ? <span className="ml-2 text-xs text-[var(--fo-muted)]">(opcional)</span> : null}
                    {i.descripcion ? <span className="block text-xs text-[var(--fo-muted)]">{i.descripcion}</span> : null}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{i.cantidad}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(i.precioUnitario)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(totales?.renglones[i.id]?.neto ?? i.precioUnitario * i.cantidad)}</td>
                  {costos ? <td className="py-2 pr-2 text-right tabular-nums">{c && c.costo !== null ? pesosPedido(c.costo) : "—"}</td> : null}
                  {costos ? <td className="py-2 text-right tabular-nums">{c && c.margen !== null ? pesosPedido(c.margen) : "—"}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {totales ? (
        <div className="ml-auto max-w-xs space-y-1 border-t border-[var(--fo-border)] pt-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--fo-muted)]">Subtotal</span>
            <span className="tabular-nums">{pesosPedido(totales.subtotal)}</span>
          </div>
          {totales.descuentoItems + totales.descuentoGlobal > 0 ? (
            <div className="flex justify-between gap-2">
              <span className="text-[var(--fo-muted)]">Descuentos</span>
              <span className="tabular-nums">−{pesosPedido(totales.descuentoItems + totales.descuentoGlobal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-2 font-semibold">
            <span>Total de los ítems</span>
            <span className="tabular-nums">{pesosPedido(totales.total)}</span>
          </div>
          {costos ? (
            <>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--fo-muted)]">Costo conocido</span>
                <span className="tabular-nums">{pesosPedido(costos.costoTotal)}</span>
              </div>
              <div className="flex justify-between gap-2 font-medium">
                <span>Margen</span>
                <span className="tabular-nums">{pesosPedido(costos.margen)}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
