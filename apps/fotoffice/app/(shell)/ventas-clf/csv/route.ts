import { armarCsvExcel, nombreArchivoExport } from "@/lib/listado/csv";
import type { ColumnaExport } from "@/lib/listado/tipos";
import { accesoVentasClf, ventasDelMes, type VentaFila } from "@/lib/clf/ventas-servidor";
import { etiquetaValidacion } from "@/lib/clf/ventas-vista";
import { parseRoyaltyMonth } from "@/lib/store/artworks/royalty-report";

export const dynamic = "force-dynamic";

/** El CSV escribe los importes desde centavos. */
const c = (pesos: number | null): number | null => (pesos === null ? null : Math.round(pesos * 100));

const COLUMNAS: ColumnaExport<VentaFila>[] = [
  { titulo: "Fecha", tipo: "fechaHora", valor: (v) => v.pagadoEl },
  { titulo: "Pedido CLF", tipo: "numero", valor: (v) => v.clfOrderId },
  { titulo: "Álbum", tipo: "texto", valor: (v) => v.albumTitulo },
  { titulo: "Detalle", tipo: "texto", valor: (v) => v.detalle },
  { titulo: "Pagó la familia", tipo: "importe", valor: (v) => c(v.pagoFamiliaArs) },
  { titulo: "Tu precio", tipo: "importe", valor: (v) => c(v.netoFotografoArs) },
  { titulo: "Comisión plataforma", tipo: "importe", valor: (v) => c(v.mpComisionPlataformaArs ?? v.comisionPlataformaArs) },
  { titulo: "Comisión Mercado Pago", tipo: "importe", valor: (v) => c(v.mpComisionMpArs) },
  { titulo: "Acreditado", tipo: "importe", valor: (v) => c(v.mpAcreditadoArs) },
  { titulo: "Reintegrado", tipo: "importe", valor: (v) => c(v.mpReintegradoArs) },
  { titulo: "Fecha del reintegro", tipo: "fechaHora", valor: (v) => v.reintegradoEl },
  { titulo: "Id de pago de Mercado Pago", tipo: "texto", valor: (v) => v.mpPaymentId },
  { titulo: "Estado", tipo: "texto", valor: (v) => etiquetaValidacion(v.validacion) },
];

/** CSV de «Ventas CLF» del mes, con el mismo permiso que la pantalla. Sin datos de compradores. */
export async function GET(request: Request) {
  const acceso = await accesoVentasClf();
  if (!acceso) return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  const mes = parseRoyaltyMonth(url.searchParams.get("mes"));
  const a = url.searchParams.get("album");
  const albumId = a && /^\d{1,10}$/.test(a) ? Number(a) : null;
  const ventas = await ventasDelMes(acceso.workspaceId, mes, albumId);
  return new Response(armarCsvExcel(COLUMNAS, ventas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivoExport(acceso.workspaceName, `ventas-clf-${mes}`)}"`,
      "Cache-Control": "no-store",
    },
  });
}
