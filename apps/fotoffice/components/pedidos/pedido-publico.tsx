import type { ReactNode } from "react";
import { pesosPedido } from "@/lib/pedidos/pantalla";
import type { ItemPublicoPedido, OrganizacionPublica, VistaPedidoPublica } from "@/lib/pedidos/vista-publica";

/**
 * El pedido como lo ve el cliente (enlace público). Sólo recibe la `VistaPedidoPublica`, que no
 * tiene costos, notas internas ni datos de otros pedidos: este componente no puede mostrar lo que
 * no le llega. Componente de servidor.
 */

/** Encabezado con la marca de la organización (también lo usa el recibo). */
export function MarcaPublica({ organizacion, children }: { organizacion: OrganizacionPublica; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--fo-border)] pb-4">
      <div className="flex items-center gap-3">
        {organizacion.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo de la organización (URL pública suya)
          <img src={organizacion.logoUrl} alt="" className="h-12 w-auto max-w-[160px] object-contain" referrerPolicy="no-referrer" />
        ) : null}
        <p className="text-lg font-semibold">{organizacion.nombre}</p>
      </div>
      {children ? <div className="text-right text-sm">{children}</div> : null}
    </header>
  );
}

/** WhatsApp y correo de la organización, si los publicó. */
export function ContactoPublico({ organizacion }: { organizacion: OrganizacionPublica }) {
  if (!organizacion.whatsappUrl && !organizacion.email) return null;
  return (
    <p className="no-imprimir text-sm opacity-80">
      ¿Tenés dudas? Escribinos
      {organizacion.whatsappUrl ? (
        <>
          {" "}por{" "}
          <a href={organizacion.whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
            WhatsApp
          </a>
        </>
      ) : null}
      {organizacion.whatsappUrl && organizacion.email ? " o" : null}
      {organizacion.email ? (
        <>
          {" "}a{" "}
          <a href={`mailto:${organizacion.email}`} className="underline">
            {organizacion.email}
          </a>
        </>
      ) : null}
      .
    </p>
  );
}

function Renglon({ i }: { i: ItemPublicoPedido }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">
          {i.nombre}
          {i.opcional ? <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-xs font-normal opacity-70">Opcional</span> : null}
        </p>
        {i.descripcion ? <p className="whitespace-pre-line text-sm opacity-75">{i.descripcion}</p> : null}
        <p className="text-xs opacity-70">
          {i.cantidad.toLocaleString("es-AR")} × {pesosPedido(i.precioUnitario)}
          {i.descuento
            ? ` · descuento ${i.descuento.tipo === "PORCENTAJE" ? `${i.descuento.valor.toLocaleString("es-AR")} %` : pesosPedido(i.descuento.valor)}`
            : ""}
        </p>
      </div>
      <p className="shrink-0 tabular-nums font-medium">{pesosPedido(i.neto)}</p>
    </li>
  );
}

export function PedidoPublico({ vista }: { vista: VistaPedidoPublica }) {
  const secciones: (string | null)[] = [];
  for (const i of vista.items) if (!secciones.includes(i.seccion)) secciones.push(i.seccion);
  const cancelado = vista.estado === "CANCELADO";
  return (
    <article className="space-y-6">
      <MarcaPublica organizacion={vista.organizacion}>
        <p className="font-semibold">Pedido N° {vista.numero}</p>
        <p className="opacity-70">{vista.estadoEtiqueta}</p>
      </MarcaPublica>

      {cancelado ? <p className="fo-card p-4">Este pedido está cancelado. Si tenés dudas, escribinos.</p> : null}

      {vista.evento.etiqueta || vista.evento.fecha ? (
        <section aria-label="Evento" className="text-sm">
          {vista.evento.etiqueta ? <p className="font-medium">{vista.evento.etiqueta}</p> : null}
          {vista.evento.fecha ? <p className="opacity-70">Fecha del evento: {vista.evento.fecha}</p> : null}
        </section>
      ) : null}

      <section aria-label="Ítems" className="space-y-4">
        {vista.items.length === 0 ? <p className="opacity-70">Este pedido no tiene ítems.</p> : null}
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
        {vista.items.length > 0 ? (
          <>
            <div className="flex justify-between gap-2">
              <span className="opacity-70">Subtotal</span>
              <span className="tabular-nums">{pesosPedido(vista.totales.subtotal)}</span>
            </div>
            {vista.totales.descuentos > 0 ? (
              <div className="flex justify-between gap-2">
                <span className="opacity-70">Descuentos</span>
                <span className="tabular-nums">−{pesosPedido(vista.totales.descuentos)}</span>
              </div>
            ) : null}
          </>
        ) : null}
        {vista.formaDePago ? (
          <div className="flex justify-between gap-2">
            <span className="opacity-70">Forma de pago</span>
            <span className="text-right">{vista.formaDePago.etiqueta}</span>
          </div>
        ) : null}
        {vista.formaDePago && vista.formaDePago.interes > 0 ? (
          <div className="flex justify-between gap-2">
            <span className="opacity-70">Interés de financiación</span>
            <span className="tabular-nums">{pesosPedido(vista.formaDePago.interes)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{pesosPedido(vista.plan.total)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="opacity-70">Pagado</span>
          <span className="tabular-nums">{pesosPedido(vista.plan.cobrado)}</span>
        </div>
        <div className="flex justify-between gap-2 font-semibold">
          <span>Saldo</span>
          <span className="tabular-nums">{pesosPedido(vista.plan.saldo)}</span>
        </div>
        {!cancelado && vista.plan.vencido > 0 ? (
          <div className="flex justify-between gap-2 text-[var(--fo-danger)]">
            <span>Vencido</span>
            <span className="tabular-nums">{pesosPedido(vista.plan.vencido)}</span>
          </div>
        ) : null}
        {vista.totales.cantidadOpcionales > 0 ? (
          <p className="text-xs opacity-70">Los opcionales ({pesosPedido(vista.totales.opcionales)}) no están incluidos en el total.</p>
        ) : null}
      </section>

      <section aria-label="Plan de pagos" className="space-y-2">
        <h2 className="text-base font-semibold">Plan de pagos</h2>
        {vista.plan.cuotas.length === 0 ? (
          <p className="text-sm opacity-70">Este pedido no tiene cuotas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs opacity-70">
                  <th className="py-1 pr-2 font-medium">Cuota</th>
                  <th className="py-1 pr-2 font-medium">Vence</th>
                  <th className="py-1 pr-2 text-right font-medium">Importe</th>
                  <th className="py-1 pr-2 text-right font-medium">Saldo</th>
                  <th className="py-1 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {vista.plan.cuotas.map((c) => (
                  <tr key={c.numero} className="border-t border-[var(--fo-border)]">
                    <td className="py-2 pr-2 tabular-nums">{c.numero}</td>
                    <td className="py-2 pr-2">{c.vence}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(c.importe)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(c.saldo)}</td>
                    <td className={`py-2 ${c.estado === "VENCIDA" ? "font-medium text-[var(--fo-danger)]" : ""}`}>{c.estadoEtiqueta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Recibos" className="space-y-2">
        <h2 className="text-base font-semibold">Recibos</h2>
        {vista.recibos.length === 0 ? (
          <p className="text-sm opacity-70">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {vista.recibos.map((r) => (
              <li key={r.numero} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {r.url ? (
                    <a href={r.url} className="font-medium underline" rel="noreferrer">
                      Recibo N° {r.numero}
                    </a>
                  ) : (
                    <span className="font-medium">Recibo N° {r.numero}</span>
                  )}
                  <span className="block text-xs opacity-70">
                    {r.fecha} · {r.medio}
                    {r.anulado ? " · Anulado" : ""}
                  </span>
                </span>
                <span className={`tabular-nums ${r.anulado ? "line-through opacity-60" : ""}`}>{pesosPedido(r.importe)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContactoPublico organizacion={vista.organizacion} />
    </article>
  );
}
