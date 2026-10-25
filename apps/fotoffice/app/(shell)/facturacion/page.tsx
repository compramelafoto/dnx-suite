import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireFacturacion } from "@/lib/invoicing/access";
import { CBTE_FACTURA_C, CBTE_LABELS, ENVIRONMENT_LABELS, STATUS_LABELS, esAmbiente, type CbteTipo, type InvoiceStatus } from "@/lib/invoicing/constants";
import { aIsoFecha } from "@/lib/invoicing/pedido";
import { numeroComprobante, pesos } from "@/lib/invoicing/pdf";
import { leerPerfil, listarComprobantes } from "@/lib/invoicing/servicio";
import { decimalArsToMinor } from "@/lib/membership/money";
import { anularAction, conciliarAction, emitirAction } from "./actions";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  AUTORIZADA: "text-[var(--fo-success)] border-[var(--fo-success)]",
  PENDIENTE: "text-[var(--fo-danger)] border-[var(--fo-danger)]",
  RECHAZADA: "text-[var(--fo-danger)] border-[var(--fo-danger)]",
  ANULADA: "text-[var(--fo-muted)] border-[var(--fo-border)]",
  BORRADOR: "text-[var(--fo-muted)] border-[var(--fo-border)]",
};

function dia(aaaammdd: string) {
  const iso = aIsoFecha(aaaammdd);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * Los comprobantes emitidos, del más nuevo al más viejo. Nada se borra: los rechazados y los
 * anulados quedan a la vista con su motivo.
 */
export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace, puedeEmitir, puedeConfigurar } = await requireFacturacion("ver");
  const sp = await searchParams;
  const [perfil, comprobantes] = await Promise.all([leerPerfil(workspace.id), listarComprobantes(workspace.id)]);
  const ambiente = perfil && esAmbiente(perfil.activeEnvironment) ? perfil.activeEnvironment : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Facturas C y notas de crédito C autorizadas por ARCA. Se emiten desde Ventas hechas o desde la ficha de un pedido."
        actions={puedeConfigurar ? <Link className="fo-btn fo-btn-secondary text-sm" href="/workspace/configuracion/facturacion">Configurar</Link> : null}
      />

      {!perfil ? (
        <p className="fo-card p-4 text-sm">
          Todavía no se conectó FOTOFFICE con ARCA.{" "}
          {puedeConfigurar ? <Link className="underline" href="/workspace/configuracion/facturacion">Empezá acá</Link> : "Pedíselo al dueño o a un administrador."}
        </p>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">
          Emitiendo en: <strong>{ambiente ? ENVIRONMENT_LABELS[ambiente] : "—"}</strong>, punto de venta {perfil.defaultPointOfSale ?? "sin definir"}.
        </p>
      )}

      {sp.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">{sp.error}</p> : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{sp.ok}</p> : null}

      {comprobantes.length === 0 ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">Todavía no se emitió ningún comprobante.</div>
      ) : (
        <div className="space-y-3">
          {comprobantes.map((c) => {
            const status = c.status as InvoiceStatus;
            const nombre = CBTE_LABELS[c.cbteTipo as CbteTipo] ?? `Comprobante ${c.cbteTipo}`;
            const ultimo = c.events[0];
            return (
              <details key={c.id} className="fo-card overflow-hidden">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-sm marker:content-none">
                  <span className="font-semibold">
                    {nombre} {c.cbteNumero !== null ? numeroComprobante(c.pointOfSale, c.cbteNumero) : "(sin número)"}
                  </span>
                  <span className="text-[var(--fo-muted)]">{dia(c.cbteFch)}</span>
                  <span className="text-[var(--fo-muted)]">{c.receptorName}</span>
                  {c.environment !== "PRODUCCION" ? <span className="rounded-full border px-2 py-0.5 text-xs">Prueba</span> : null}
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${COLOR[status] ?? ""}`}>{STATUS_LABELS[status] ?? status}</span>
                  <span className="ml-auto font-medium">{pesos(decimalArsToMinor(c.impTotal))}</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--fo-border)] px-4 py-4 text-sm">
                  {c.cae ? <p>CAE {c.cae}</p> : null}
                  {ultimo?.note ? <p className="text-[var(--fo-muted)]">Último movimiento: {ultimo.note}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {c.saleId ? <Link className="underline" href="/ventas/historial">Ver la venta</Link> : null}
                    {c.pedidoId ? <Link className="underline" href={`/pedidos/${c.pedidoId}`}>Ver el pedido</Link> : null}
                    {status === "AUTORIZADA" || status === "ANULADA" ? (
                      <a className="fo-btn fo-btn-secondary text-sm" href={`/api/facturacion/${c.id}/pdf`} target="_blank" rel="noopener">
                        Ver PDF
                      </a>
                    ) : null}
                    {puedeEmitir && status === "BORRADOR" ? (
                      <form action={emitirAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="fo-btn fo-btn-primary text-sm" type="submit">Emitir</button>
                      </form>
                    ) : null}
                    {puedeEmitir && status === "PENDIENTE" ? (
                      <form action={conciliarAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="fo-btn fo-btn-primary text-sm" type="submit">Conciliar con ARCA</button>
                      </form>
                    ) : null}
                  </div>
                  {puedeEmitir && status === "AUTORIZADA" && c.cbteTipo === CBTE_FACTURA_C ? (
                    <form action={anularAction} className="flex flex-wrap items-end gap-2 border-t border-[var(--fo-border)] pt-3">
                      <input type="hidden" name="id" value={c.id} />
                      <label className="min-w-[220px] flex-1 space-y-1">
                        <span className="text-[var(--fo-muted)]">Motivo de la anulación</span>
                        <input name="motivo" className="fo-input w-full" placeholder="Por qué se anula" required />
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" name="confirmo" value="1" required /> Entiendo que se emite una nota de crédito en ARCA
                      </label>
                      <button type="submit" className="fo-btn fo-btn-danger-outline shrink-0 text-sm">Anular con nota de crédito</button>
                    </form>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
