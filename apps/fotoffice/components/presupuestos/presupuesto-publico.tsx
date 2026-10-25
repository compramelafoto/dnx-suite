import { pesos } from "@/lib/presupuestos/editor";
import { importeDeOpcion, type OpcionPublica } from "@/lib/presupuestos/opciones-pago";
import type { AlternativaDeLaVista, ItemDeLaVista, VistaPublica } from "@/lib/presupuestos/vista-publica";

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

function OpcionesDePago({ opciones }: { opciones: OpcionPublica[] }) {
  return (
    <section aria-label="Opciones de pago" className="space-y-2">
      <h2 className="text-base font-semibold">Opciones de pago</h2>
      <ul className="divide-y divide-[var(--fo-border)] text-sm">
        {opciones.map((o) => (
          <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span>
              <span className="font-medium">{o.etiqueta}</span>
              {o.nota && o.nota !== o.etiqueta ? <span className="block text-xs opacity-75">{o.nota}</span> : null}
            </span>
            <span className="tabular-nums">{importeDeOpcion(o)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** El plan en cuotas sin interés más largo de una opción (null si no hay). */
export function cuotasSinInteres(opciones: readonly OpcionPublica[], total: number): OpcionPublica | null {
  const sin = opciones.filter((o) => o.cuotas > 1 && o.total <= total + 0.5);
  return sin.sort((a, b) => b.cuotas - a.cuotas)[0] ?? null;
}

/** Una opción del presupuesto (Básico, Premium…): qué incluye, su precio y «Elegir esta». */
function TarjetaAlternativa({ a }: { a: AlternativaDeLaVista }) {
  const total = a.cobro && a.cobro.iva > 0 ? a.cobro.totalConIva : a.totales.total;
  const cuotas = cuotasSinInteres(a.opcionesPago, total);
  const incluye = a.items.filter((i) => !i.opcional);
  const opcionales = a.items.filter((i) => i.opcional);
  return (
    <section
      aria-label={`Opción ${a.nombre}`}
      className={`flex flex-col gap-4 rounded-xl border p-4 ${a.masElegida ? "border-2 border-[var(--fo-accent)]" : "border-[var(--fo-border)]"}`}
    >
      <div className="space-y-1">
        {a.masElegida ? (
          <span className="inline-block rounded-full bg-[var(--fo-accent)] px-2 py-0.5 text-xs font-semibold text-white">La más elegida</span>
        ) : null}
        <h2 className="text-lg font-semibold">{a.nombre}</h2>
        {a.descripcion ? <p className="whitespace-pre-line text-sm opacity-75">{a.descripcion}</p> : null}
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{pesos(total)}</p>
        {a.cobro && a.cobro.iva > 0 ? <p className="text-xs opacity-70">IVA incluido ({a.cobro.ivaPorcentaje} %)</p> : null}
        {cuotas ? <p className="text-sm opacity-80">Sin interés: {importeDeOpcion(cuotas)}</p> : null}
        {a.totales.descuentos > 0 ? <p className="text-xs opacity-70">Con {pesos(a.totales.descuentos)} de descuento</p> : null}
        {a.cobro && a.cobro.senaPorcentaje > 0 ? (
          <p className="text-xs opacity-70">Reservás la fecha con una seña del {a.cobro.senaPorcentaje} %.</p>
        ) : null}
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-semibold">Qué incluye</h3>
        <ul className="space-y-1 text-sm">
          {incluye.map((i) => (
            <li key={i.id} className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>
                {i.cantidad !== 1 ? `${i.cantidad.toLocaleString("es-AR")} × ` : ""}
                {i.nombre}
                {i.descripcion ? <span className="block whitespace-pre-line text-xs opacity-70">{i.descripcion}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {opcionales.length > 0 ? (
          <p className="pt-1 text-xs opacity-70">
            Opcionales (aparte): {opcionales.map((i) => `${i.nombre} (${pesos(i.neto)})`).join(", ")}
          </p>
        ) : null}
      </div>
      <a href={`#elegir-${encodeURIComponent(a.id)}`} className="no-imprimir fo-btn fo-btn-primary text-center text-sm">
        Elegir esta
      </a>
    </section>
  );
}

/** Las opciones lado a lado (en el celular, una debajo de otra). */
function Alternativas({ alternativas }: { alternativas: AlternativaDeLaVista[] }) {
  const columnas = alternativas.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2";
  return (
    <section aria-label="Opciones del presupuesto" className="space-y-3">
      <p className="text-sm opacity-80">Te armamos {alternativas.length} opciones. Elegí la que más te guste y aceptala más abajo.</p>
      <div className={`grid gap-4 ${alternativas.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : columnas}`}>
        {alternativas.map((a) => (
          <TarjetaAlternativa key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

export function PresupuestoPublico({ vista }: { vista: VistaPublica }) {
  const conAlternativas = vista.alternativas.length > 0;
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

      {conAlternativas ? <Alternativas alternativas={vista.alternativas} /> : null}
      {vista.alternativaElegida ? <p className="text-sm font-semibold">Opción elegida: {vista.alternativaElegida}</p> : null}

      {conAlternativas ? null : (
      <>
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
        {vista.cobro && vista.cobro.iva > 0 ? (
          <>
            <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2">
              <span className="opacity-70">Total sin IVA</span>
              <span className="tabular-nums">{pesos(vista.totales.total)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="opacity-70">IVA ({vista.cobro.ivaPorcentaje} %)</span>
              <span className="tabular-nums">{pesos(vista.cobro.iva)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{pesos(vista.cobro.totalConIva)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{pesos(vista.totales.total)}</span>
          </div>
        )}
        {vista.cobro && vista.cobro.senaPorcentaje > 0 ? (
          <p className="text-xs opacity-70">Para reservar la fecha se paga una seña del {vista.cobro.senaPorcentaje} % al aceptar.</p>
        ) : null}
        {vista.totales.cantidadOpcionales > 0 ? (
          <p className="text-xs opacity-70">
            Los opcionales ({pesos(vista.totales.opcionales)}) no están incluidos en el total.
          </p>
        ) : null}
      </section>

      {vista.opcionesPago.length > 0 ? <OpcionesDePago opciones={vista.opcionesPago} /> : null}
      </>
      )}
      {vista.cobro && vista.cobro.descuentoTransferencia > 0 ? (
        <p className="text-sm opacity-80">
          Pagando por transferencia o en efectivo tenés un {vista.cobro.descuentoTransferencia} % de descuento.
          {vista.mercadoPago ? "" : " Por ahora los pagos se hacen por transferencia o en efectivo."}
        </p>
      ) : null}
      {vista.propuestaPago ? (
        <section aria-label="Propuesta de pago" className="space-y-1">
          <h2 className="text-base font-semibold">Forma de pago</h2>
          <p className="whitespace-pre-line text-sm">{vista.propuestaPago}</p>
        </section>
      ) : null}
      {vista.condiciones || vista.cobro?.politicaCancelacion ? (
        <section aria-label="Condiciones" className="space-y-1">
          <h2 className="text-base font-semibold">Condiciones</h2>
          {vista.condiciones ? <p className="whitespace-pre-line text-sm">{vista.condiciones}</p> : null}
          {vista.cobro?.politicaCancelacion ? (
            <div className="space-y-1 pt-1">
              <h3 className="text-sm font-semibold">Política de cancelación</h3>
              <p className="whitespace-pre-line text-sm">{vista.cobro.politicaCancelacion}</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {vista.aceptacion ? (
        <p className="rounded-lg border border-[var(--fo-border)] p-3 text-sm">
          Aceptado por {vista.aceptacion.nombre} el {vista.aceptacion.fecha} (hora de Argentina).
          {vista.alternativaElegida ? ` Opción: ${vista.alternativaElegida}.` : ""}
          {vista.aceptacion.opcion ? ` Forma de pago elegida: ${vista.aceptacion.opcion}.` : ""}
        </p>
      ) : null}
    </article>
  );
}
