import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { contextoDeListado, exigirCapacidad } from "@/lib/listado/acceso";
import { definicionDe } from "@/lib/listado/registro";
import { consultaSaneada, leerConsulta } from "@/lib/listado/consulta";
import { resolverConsulta } from "@/lib/listado/ejecutar";
import { armarCsvExcel, nombreArchivoExport, TOPE_EXPORTACION } from "@/lib/listado/csv";
import { registrarActividad } from "@/lib/listado/actividad";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const ctx = await contextoDeListado(clave);
  if (!ctx || !exigirCapacidad(ctx, "verDinero")) return new NextResponse(null, { status: 404 });
  const def = await definicionDe(clave, ctx);
  if (!def) return new NextResponse(null, { status: 404 });

  const sp = new URLSearchParams(req.nextUrl.searchParams);
  const idsCrudos = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  sp.delete("ids");

  let filas: unknown[];
  if (idsCrudos.length) {
    if (idsCrudos.length > TOPE_EXPORTACION) return tope();
    filas = await def.traerPorIds(ctx, Array.from(new Set(idsCrudos)));
  } else {
    const { consulta } = leerConsulta(def, sp);
    const { resuelta } = await resolverConsulta(def, ctx, consulta, hoyEnBuenosAires());
    const ids = await def.traerIds(ctx, resuelta, TOPE_EXPORTACION + 1);
    if (ids.length > TOPE_EXPORTACION) return tope();
    // Sin filas y con aviso (p. ej. una subconsulta pasó su tope): se explica, no un archivo vacío.
    if (ids.length === 0 && def.aviso) {
      const aviso = await def.aviso(ctx, resuelta);
      if (aviso) return rechazo(aviso);
    }
    filas = await def.traerPorIds(ctx, ids);
  }

  const csv = armarCsvExcel(def.exportar.columnas, filas);
  // Se registra lo que la lista entendió (nunca el texto crudo de la dirección) y, en una
  // exportación por selección, los ids que de verdad salieron en el archivo.
  await registrarActividad(prisma, {
    ctx,
    listKey: clave,
    kind: "EXPORT",
    rowCount: filas.length,
    query: idsCrudos.length ? "" : consultaSaneada(def, sp),
    detail: idsCrudos.length ? { ids: filas.map((f) => def.idDe(f)) } : undefined,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivoExport(ctx.workspaceName, clave)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function tope() {
  return rechazo(`Son más de ${TOPE_EXPORTACION} filas. Filtrá un poco más para exportar.`);
}

function rechazo(texto: string) {
  return new NextResponse(texto, {
    status: 422,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
