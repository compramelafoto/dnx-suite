import { pesos } from "@/lib/presupuestos/editor";
import type { ItemDeLaVista, VistaPublica } from "@/lib/presupuestos/vista-publica";

/**
 * El presupuesto como lo ve el cliente (enlace público y vista para imprimir). Sólo recibe la
 * `VistaPublica`, que no tiene costos ni márgenes: este componente no puede mostrar lo que no le
 * llega. Los opcionales se muestran marcados y aparte del total.
 */

/** Al imprimir (o "Guardar como PDF") sale sólo el presupuesto, sin el menú ni el pie del sitio. */
export const ESTILO_IMPRESION = `@media print {
  body * { visibility: hidden !important; }
  #presupuesto-imprimible, #presupuesto-imprimible * { visibility: visible !important; }
  #presupuesto-imprimible { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; }
  .no-imprimir { display: none !important; }
}`;

function descuento(i: ItemDeLaVista): string {
  if (!i.descuento) return "";
  return i.descuento.tipo === "PORCENTAJE" ? `${i.descuento.valor.toLocaleString("es-AR")} %` : pesos(i.descuento.valor);
}

function Renglon({ i }: { i: ItemDeLaVista }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">
          {i.nombre}
          {i.opcional ? <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-xs font-normal opacity-70">Opcional</span> : null}
        </p>
        {i.descripcion ? <p className="whitespace-pre-line text-sm opacity-75">{i.descripcion}</p> : null}
        <p className="text-xs opacity-70">
          {i.cantidad.toLocaleString("es-AR")} × {pesos(i.precioUnitario)}
          {i.descuento ? ` · descuento ${descuento(i)}` : ""}
        </p>
      </div>
      <p className="shrink-0 tabular-nums font-medium">{pesos(i.neto)}</p>
    </li>
  );
}

export function PresupuestoPublico({ vista }: { vista: VistaPublica }) {
  const secciones: (string | null)[] = [];
  for (const i of vista.items) if (!secciones.includes(i.seccion)) secciones.push(i.seccion);
  return (
    <article id="presupuesto-imprimible" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--fo-border)] pb-4">
        <div className="flex items-center gap-3">
          {vista.organizacion.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo de la organización (URL pública suya)
            <img src={vista.organizacion.logoUrl} alt="" className="h-12 w-auto max-w-[160px] object-contain" referrerPolicy="no-referrer" />
          ) : null}
          <p className="text-lg font-semibold">{vista.organizacion.nombre}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">Presupuesto{vista.numero ? ` N° ${vista.numero}` : ""}</p>
          <p className="opacity-70">Versión {vista.version}</p>
          {vista.vence ? <p className="opacity-70">Válido hasta el {vista.vence}</p> : null}
        </div>
      </header>

      <section aria-label="Ítems" className="space-y-4">
        {vista.items.length === 0 ? <p className="opacity-70">Este presupuesto no tiene ítems.</p> : null}
        {secciones.map((sec) => (
          <div key={sec ?? "__sin__"}>
            {sec !== null ? <h2 className="text-base font-semibold">{sec}</h2> : null}
            <ul className="divide-y divide-[var(--fo-border)]">
              {vista.items
                .filter((i) => i.seccion === sec)
                .map((i) => (
                  <Renglon key={i.id} i={i} />
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-label="Totales" className="ml-auto max-w-sm space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <span className="opacity-70">Subtotal</span>
          <span className="tabular-nums">{pesos(vista.totales.subtotal)}</span>
        </div>
        {vista.totales.descuentos > 0 ? (
          <div className="flex justify-between gap-2">
            <span className="opacity-70">Descuentos</span>
            <span className="tabular-nums">−{pesos(vista.totales.descuentos)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{pesos(vista.totales.total)}</span>
        </div>
        {vista.totales.cantidadOpcionales > 0 ? (
          <p className="text-xs opacity-70">
            Los opcionales ({pesos(vista.totales.opcionales)}) no están incluidos en el total.
          </p>
        ) : null}
      </section>

      {vista.propuestaPago ? (
        <section aria-label="Propuesta de pago" className="space-y-1">
          <h2 className="text-base font-semibold">Forma de pago</h2>
          <p className="whitespace-pre-line text-sm">{vista.propuestaPago}</p>
        </section>
      ) : null}
      {vista.condiciones ? (
        <section aria-label="Condiciones" className="space-y-1">
          <h2 className="text-base font-semibold">Condiciones</h2>
          <p className="whitespace-pre-line text-sm">{vista.condiciones}</p>
        </section>
      ) : null}
      {vista.aceptacion ? (
        <p className="rounded-lg border border-[var(--fo-border)] p-3 text-sm">
          Aceptado por {vista.aceptacion.nombre} el {vista.aceptacion.fecha} (hora de Argentina).
        </p>
      ) : null}
    </article>
  );
}
