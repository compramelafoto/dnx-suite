import { NextResponse } from "next/server";
import { contextoDeGalerias } from "@/lib/galerias/contexto";
import { csvDeSeleccion } from "@/lib/galerias/exportar";
import { filasParaCsv } from "@/lib/galerias/revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nombreSeguro(texto: string): string {
  const s = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return s || "cliente";
}

/**
 * CSV (para Excel) con las fotos que eligió un cliente y sus comentarios. Guarda: sesión, workspace, módulo
 * `gallery` encendido y permiso de Ver; sin permiso o con ids ajenos, 404 sin decir el motivo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; clienteId: string }> }) {
  const ctx = await contextoDeGalerias("ver");
  if (!ctx) return new NextResponse(null, { status: 404 });
  const { id, clienteId } = await params;
  const datos = await filasParaCsv(ctx, id, clienteId);
  if (!datos) return new NextResponse(null, { status: 404 });
  const nombre = `seleccion-${nombreSeguro(datos.galeriaNumero)}-${nombreSeguro(datos.clienteNombre)}.csv`;
  return new NextResponse(csvDeSeleccion(datos.filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
