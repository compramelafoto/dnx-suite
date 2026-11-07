import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { resumenConexionClf } from "@/lib/clf/conexion";
import { accesoVentasClf, albumesConVentas, ventasDelMes } from "@/lib/clf/ventas-servidor";
import { etiquetaValidacion, totalesDelMes } from "@/lib/clf/ventas-vista";
import { arDate, monthLabel, parseRoyaltyMonth, shiftMonth } from "@/lib/store/artworks/royalty-report";

export const dynamic = "force-dynamic";

const pesos = (n: number) => `${n < 0 ? "-" : ""}$ ${Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const COLOR: Record<string, string> = {
  VALIDADA: "text-[var(--fo-success,#15803d)]",
  VALIDADA_CUENTA_PROPIA: "text-[var(--fo-success,#15803d)]",
  CON_DIFERENCIA: "text-[var(--fo-danger)]",
  NO_EN_TU_MP: "text-[var(--fo-danger)]",
  REINTEGRADA: "text-[var(--fo-muted)]",
  REINTEGRO_PARCIAL: "text-[var(--fo-muted)]",
  PENDIENTE: "text-[var(--fo-muted)]",
};

/**
 * Ventas CLF (conexión con CLF, etapa 2): lo que el fotógrafo cobró por CompraMeLaFoto, venta por venta, validado
 * contra su Mercado Pago. Separado de la Caja. Sólo con «ver dinero» en el módulo `clf-sales`. Sin datos de compradores.
 */
export default async function VentasClfPage({ searchParams }: { searchParams: Promise<{ mes?: string; album?: string }> }) {
  const acceso = await accesoVentasClf();
  if (!acceso) notFound();
  const sp = await searchParams;
  const mes = parseRoyaltyMonth(sp.mes);
  const albumId = sp.album && /^\d{1,10}$/.test(sp.album) ? Number(sp.album) : null;

  const [ventas, albumes, conexion] = await Promise.all([
    ventasDelMes(acceso.workspaceId, mes, albumId),
    albumesConVentas(acceso.workspaceId),
    resumenConexionClf(acceso.workspaceId),
  ]);
  const t = totalesDelMes(ventas, mes);
  const qs = (m: string) => `?mes=${m}${albumId !== null ? `&album=${albumId}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ventas CLF"
        description="Lo que cobrás por CompraMeLaFoto, validado contra tu Mercado Pago. Va aparte: no toca la Caja."
        actions={
          <a className="fo-btn fo-btn-secondary text-sm" href={`/ventas-clf/csv${qs(mes)}`}>
            Descargar CSV
          </a>
        }
      />

      {!conexion ? (
        <p className="fo-card p-3 text-sm">
          Todavía no conectaste tu cuenta de CompraMeLaFoto. <Link className="underline" href="/workspace/configuracion/compramelafoto">Conectala desde Configuración →</Link>
        </p>
      ) : conexion.cerrada ? (
        <p className="fo-card p-3 text-sm">La conexión con CompraMeLaFoto está cerrada: se muestran las ventas ya traídas, pero no llegan nuevas.</p>
      ) : conexion.ultimoError ? (
        <p className="fo-card p-3 text-sm text-[var(--fo-danger)]">{conexion.ultimoError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link className="fo-btn fo-btn-ghost text-sm" href={`/ventas-clf${qs(shiftMonth(mes, -1))}`}>← Anterior</Link>
        <span className="font-semibold capitalize">{monthLabel(mes)}</span>
        <Link className="fo-btn fo-btn-ghost text-sm" href={`/ventas-clf${qs(shiftMonth(mes, 1))}`}>Siguiente →</Link>
        {albumes.length > 1 ? (
          <form className="flex items-center gap-2" action="/ventas-clf">
            <input type="hidden" name="mes" value={mes} />
            <select name="album" className="fo-input text-sm" defaultValue={albumId ?? ""}>
              <option value="">Todos los álbumes</option>
              {albumes.map((a) => (
                <option key={a.id} value={a.id}>{a.titulo}</option>
              ))}
            </select>
            <button type="submit" className="fo-btn fo-btn-ghost text-sm">Filtrar</button>
          </form>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="fo-card p-4">
          <p className="text-xs text-[var(--fo-muted)]">Cobrado en tu Mercado Pago</p>
          <p className="text-2xl font-semibold">{pesos(t.cobradoNeto)}</p>
          <p className="text-xs text-[var(--fo-muted)]">{t.cantidad} ventas{t.sinValidar ? ` · ${t.sinValidar} por validar` : ""}</p>
        </div>
        <div className="fo-card p-4">
          <p className="text-xs text-[var(--fo-muted)]">Tu precio (sin comisiones)</p>
          <p className="text-xl font-semibold">{pesos(t.tuPrecio)}</p>
          <p className="text-xs text-[var(--fo-muted)]">Pagaron las familias {pesos(t.pagoFamilia)}</p>
        </div>
        <div className="fo-card p-4">
          <p className="text-xs text-[var(--fo-muted)]">Comisiones</p>
          <p className="text-xl font-semibold">{pesos(t.comisionPlataforma + t.comisionMp)}</p>
          <p className="text-xs text-[var(--fo-muted)]">Plataforma {pesos(t.comisionPlataforma)} · Mercado Pago {pesos(t.comisionMp)}</p>
        </div>
        <div className="fo-card p-4">
          <p className="text-xs text-[var(--fo-muted)]">Reintegros del mes</p>
          <p className="text-xl font-semibold">{pesos(-t.reintegros)}</p>
        </div>
      </section>

      <section className="fo-card overflow-x-auto p-0">
        {ventas.length === 0 ? (
          <p className="p-4 text-sm text-[var(--fo-muted)]">No hay ventas de CompraMeLaFoto en este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fo-muted)]">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Álbum</th>
                <th className="p-3">Detalle</th>
                <th className="p-3 text-right">Pagó la familia</th>
                <th className="p-3 text-right">Tu precio</th>
                <th className="p-3 text-right">Acreditado</th>
                <th className="p-3">Pago de MP</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-t border-[var(--fo-border)]">
                  <td className="p-3 whitespace-nowrap">{arDate(v.pagadoEl)}</td>
                  <td className="p-3">{v.albumTitulo}</td>
                  <td className="p-3">{v.detalle}</td>
                  <td className="p-3 text-right">{pesos(v.pagoFamiliaArs)}</td>
                  <td className="p-3 text-right">{pesos(v.netoFotografoArs)}</td>
                  <td className="p-3 text-right">{v.mpAcreditadoArs !== null ? pesos(v.mpAcreditadoArs) : "—"}</td>
                  <td className="p-3 font-mono text-xs">{v.mpPaymentId ?? "—"}</td>
                  <td className={`p-3 whitespace-nowrap ${COLOR[v.validacion] ?? ""}`}>
                    {etiquetaValidacion(v.validacion)}
                    {v.reintegradoEl && v.mpReintegradoArs ? <span className="block text-xs">{pesos(-v.mpReintegradoArs)} el {arDate(v.reintegradoEl)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-[var(--fo-muted)]">
        «Acreditado» es lo que entró a tu Mercado Pago: lo que pagó la familia menos la comisión de la plataforma y la de Mercado Pago. «Tu precio» es el que fijaste en CompraMeLaFoto.
      </p>
    </div>
  );
}
