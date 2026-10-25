import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireFacturacion } from "@/lib/invoicing/access";
import { receptorSugerido } from "@/lib/invoicing/borrador";
import { CONCEPTO_LABELS, CONDICION_IVA_LABELS, DOC_TIPO, ENVIRONMENT_LABELS, esAmbiente } from "@/lib/invoicing/constants";
import { aIsoFecha, fechaArca } from "@/lib/invoicing/pedido";
import { pesos } from "@/lib/invoicing/pdf";
import { clienteFiscal, leerPerfil, pedidoParaFacturar, ventaParaFacturar } from "@/lib/invoicing/servicio";
import { minorToDecimalString } from "@/lib/membership/money";
import { facturarAction } from "../actions";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * «Facturar» una venta o un pedido. Por omisión, consumidor final; si la venta tiene cliente con
 * documento, se proponen sus datos. Al confirmar se guarda el comprobante y se pide el CAE en el
 * mismo acto: emitir es siempre una acción explícita de una persona.
 */
export default async function NuevaFacturaPage({ searchParams }: { searchParams: Promise<{ venta?: string; pedido?: string; error?: string }> }) {
  const { workspace } = await requireFacturacion("emitir");
  const sp = await searchParams;
  const saleId = sp.venta && ID_VALIDO.test(sp.venta) ? sp.venta : null;
  const pedidoId = !saleId && sp.pedido && ID_VALIDO.test(sp.pedido) ? sp.pedido : null;
  if (!saleId && !pedidoId) notFound();

  const perfil = await leerPerfil(workspace.id);
  const hoy = aIsoFecha(fechaArca(new Date()));
  const venta = saleId ? await ventaParaFacturar(workspace.id, saleId) : null;
  const pedido = pedidoId ? await pedidoParaFacturar(workspace.id, pedidoId) : null;
  if (!venta && !pedido) notFound();
  const cliente = await clienteFiscal(workspace.id, venta?.clientId ?? pedido?.clientId ?? null);
  const r = receptorSugerido(cliente);
  const anonimo = r.docTipo === DOC_TIPO.SIN_IDENTIFICAR;
  const conceptoInicial = venta ? 1 : 2;
  const fechaServicio = pedido?.eventDate ? pedido.eventDate.toISOString().slice(0, 10) : hoy;
  const ambiente = perfil && esAmbiente(perfil.activeEnvironment) ? perfil.activeEnvironment : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={venta ? `Facturar la venta #${venta.saleNumber}` : `Facturar el pedido ${pedido!.number}`}
        description={ambiente ? `Factura C · ${ENVIRONMENT_LABELS[ambiente]} · punto de venta ${perfil?.defaultPointOfSale ?? "sin definir"}` : "Factura C"}
      />
      {!perfil ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          Falta conectar FOTOFFICE con ARCA. <Link className="underline" href="/workspace/configuracion/facturacion">Configurar</Link>
        </p>
      ) : null}
      {sp.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">{sp.error}</p> : null}

      <form action={facturarAction} className="space-y-6">
        {venta ? <input type="hidden" name="saleId" value={venta.id} /> : <input type="hidden" name="pedidoId" value={pedido!.id} />}

        <section className="fo-card space-y-3 p-5">
          <h2 className="font-semibold">Qué se factura</h2>
          {venta ? (
            <>
              <ul className="divide-y divide-[var(--fo-border)] text-sm">
                {venta.renglones.map((i, n) => (
                  <li key={n} className="flex justify-between py-1">
                    <span>{i.qty} × {i.description}</span>
                    <span>{pesos(i.lineTotalMinor)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-right font-semibold">Total: {pesos(venta.totalMinor)}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--fo-muted)]">
                Total del pedido {pesos(pedido!.totalMinor)} · ya facturado {pesos(pedido!.facturadoMinor)} · falta {pesos(pedido!.saldoMinor)}.
              </p>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--fo-muted)]">Descripción en la factura</span>
                <input name="descripcion" className="fo-input w-full" defaultValue={`Pedido ${pedido!.number}${pedido!.eventLabel ? ` — ${pedido!.eventLabel}` : ""}`} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--fo-muted)]">Importe a facturar (pesos)</span>
                <input name="monto" className="fo-input w-full" inputMode="decimal" defaultValue={minorToDecimalString(pedido!.saldoMinor).replace(".", ",")} required />
              </label>
            </>
          )}
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Concepto</span>
            <select name="concepto" className="fo-input w-full" defaultValue={String(conceptoInicial)}>
              {([1, 2, 3] as const).map((c) => (
                <option key={c} value={c}>{CONCEPTO_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Fecha del comprobante</span>
            <input type="date" name="fecha" className="fo-input" defaultValue={hoy} required />
          </label>
          <fieldset className="grid gap-3 rounded border border-[var(--fo-border)] p-3 sm:grid-cols-3">
            <legend className="px-1 text-xs text-[var(--fo-muted)]">Sólo con servicios: el período y el vencimiento del pago</legend>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Desde</span>
              <input type="date" name="servDesde" className="fo-input w-full" defaultValue={fechaServicio} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Hasta</span>
              <input type="date" name="servHasta" className="fo-input w-full" defaultValue={fechaServicio} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Vence el pago</span>
              <input type="date" name="vtoPago" className="fo-input w-full" defaultValue={hoy} />
            </label>
          </fieldset>
        </section>

        <section className="fo-card space-y-3 p-5">
          <h2 className="font-semibold">A quién se le factura</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="anonimo" value="1" defaultChecked={anonimo} /> Consumidor final sin identificar (sin documento)
          </label>
          <p className="text-xs text-[var(--fo-muted)]">Si destildás la casilla, completá los datos del comprador. A un monotributista, responsable inscripto o exento se le factura con su CUIT.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Tipo de documento</span>
              <select name="docTipo" className="fo-input w-full" defaultValue={anonimo ? String(DOC_TIPO.DNI) : String(r.docTipo)}>
                <option value={DOC_TIPO.DNI}>DNI</option>
                <option value={DOC_TIPO.CUIT}>CUIT</option>
                <option value={DOC_TIPO.CUIL}>CUIL</option>
                <option value={DOC_TIPO.PASAPORTE}>Pasaporte</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Número</span>
              <input name="docNro" className="fo-input w-full" inputMode="numeric" defaultValue={anonimo ? "" : r.docNro} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Nombre o razón social</span>
              <input name="nombre" className="fo-input w-full" defaultValue={cliente?.nombre ?? ""} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Condición frente al IVA</span>
              <select name="ivaCondition" className="fo-input w-full" defaultValue={r.ivaCondition}>
                {Object.entries(CONDICION_IVA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--fo-muted)]">Domicilio (opcional)</span>
              <input name="domicilio" className="fo-input w-full" defaultValue={cliente?.domicilio ?? ""} />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="fo-btn fo-btn-primary">Emitir factura en ARCA</button>
          <Link className="text-sm underline" href={venta ? "/ventas/historial" : `/pedidos/${pedido!.id}`}>Volver</Link>
        </div>
        <p className="text-xs text-[var(--fo-muted)]">
          Una factura autorizada no se puede editar ni borrar: si hay un error, se anula con una nota de crédito.
        </p>
      </form>
    </div>
  );
}
