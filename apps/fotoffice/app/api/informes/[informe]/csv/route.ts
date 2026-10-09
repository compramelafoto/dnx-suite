import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { contextoDeInformes } from "@/lib/informes/acceso";
import { csvDeDetalle, csvDeFlujo, csvDeMonotributo, csvDeResultados, csvDeVentas, csvDeVentasDetalle, esInformeCsv } from "@/lib/informes/csv";
import { cargarDetalleFlujo, cargarDetalleResultados } from "@/lib/informes/detalle-datos";
import { cargarFlujo } from "@/lib/informes/flujo-datos";
import { cargarMonotributo } from "@/lib/informes/monotributo-datos";
import { cargarResultados } from "@/lib/informes/resultados-datos";
import { cargarDetalleVentas, cargarVentas } from "@/lib/informes/ventas-datos";
import { primero, valorDePeriodo } from "@/lib/informes/url";
import { nombreArchivoExport } from "@/lib/listado/csv";

export const dynamic = "force-dynamic";

/**
 * CSV de Informes: resultados, resultados-detalle, flujo, flujo-detalle, monotributo, ventas y ventas-detalle. Mismo permiso que
 * las pantallas (módulo `reports` encendido y `verDinero`); sin permiso responde 404 sin decir el motivo.
 * Todo se lee del workspace de la sesión.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ informe: string }> }) {
  const { informe } = await params;
  if (!esInformeCsv(informe)) return new NextResponse(null, { status: 404 });
  const ctx = await contextoDeInformes();
  if (!ctx) return new NextResponse(null, { status: 404 });

  const sp: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams.entries());
  let csv: string | null = null;
  let aviso: string | null = null;

  if (informe === "resultados") {
    const r = await cargarResultados(ctx, { periodo: valorDePeriodo(sp), base: primero(sp.base) });
    if (!r) return new NextResponse(null, { status: 404 });
    if (r.matriz) csv = csvDeResultados(r.matriz);
    else aviso = r.avisos[r.avisos.length - 1] ?? null;
  } else if (informe === "resultados-detalle") {
    const d = await cargarDetalleResultados(ctx, sp);
    if (!d) return new NextResponse(null, { status: 404 });
    if (d.avisos.length > 0) aviso = d.avisos[0];
    else csv = csvDeDetalle(d.todas, d.total);
  } else if (informe === "ventas") {
    const v = await cargarVentas(ctx, { periodo: valorDePeriodo(sp), agrupar: primero(sp.agrupar) });
    if (!v) return new NextResponse(null, { status: 404 });
    if (v.matriz) csv = csvDeVentas(v.matriz);
    else aviso = v.avisos[v.avisos.length - 1] ?? null;
  } else if (informe === "ventas-detalle") {
    const d = await cargarDetalleVentas(ctx, sp);
    if (!d) return new NextResponse(null, { status: 404 });
    if (d.avisos.length > 0) aviso = d.avisos[0];
    else csv = csvDeVentasDetalle(d.todas, d.total);
  } else if (informe === "flujo-detalle") {
    const d = await cargarDetalleFlujo(ctx, sp);
    if (!d) return new NextResponse(null, { status: 404 });
    if (d.avisos.length > 0) aviso = d.avisos[0];
    else csv = csvDeDetalle(d.todas, d.total);
  } else if (informe === "flujo") {
    const f = await cargarFlujo(ctx, { agrupar: primero(sp.agrupar), horizonte: primero(sp.horizonte) });
    if (!f) return new NextResponse(null, { status: 404 });
    if (f.flujo) csv = csvDeFlujo(f.flujo);
    else aviso = f.avisos[0] ?? null;
  } else {
    const m = await cargarMonotributo(ctx);
    if (!m) return new NextResponse(null, { status: 404 });
    if (m.resultado) csv = csvDeMonotributo(m.resultado, m.tope, m.categoria);
    else aviso = m.avisos[0] ?? null;
  }

  if (csv === null) {
    return new NextResponse(aviso ?? "No se pudo armar el archivo.", {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivoExport(ws?.name ?? "fotoffice", `informe-${informe}`)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
