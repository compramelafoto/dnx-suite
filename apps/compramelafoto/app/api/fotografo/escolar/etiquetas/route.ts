import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { cargarLibritos, conCodigoDeEntrega, etiquetas } from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import { safeFilename } from "@/lib/safe-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?lote=… o ?ids=… — etiquetas para los sobres (A4, 24 por hoja), en orden de impresión. Las de
 * la preventa llevan el QR de entrega; si el ítem no tenía código todavía, se le crea acá.
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const filtro = filtroDeLibritos({ ids: sp.get("ids") ?? undefined, lote: sp.get("lote") ?? undefined });
    const libros = await conCodigoDeEntrega(await cargarLibritos(actor, filtro));
    if (libros.length === 0) return NextResponse.json({ error: "No hay librititos para etiquetar." }, { status: 400 });
    const bytes = await etiquetas(libros);
    const nombre = safeFilename(`Etiquetas ${filtro.lote ?? ""}`.trim(), "etiquetas");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombre}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return respuestaDeError(err, "etiquetas");
  }
}
