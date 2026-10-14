import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { cargarLibritos, pdfUnico } from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import { MAX_LIBRITOS_POR_PDF_UNICO } from "@/lib/design-v2/produccion-reglas";
import { safeFilename } from "@/lib/safe-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET ?lote=… o ?ids=… — todos los librititos en un único PDF, en orden de impresión. */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const filtro = filtroDeLibritos({ ids: sp.get("ids") ?? undefined, lote: sp.get("lote") ?? undefined });
    const libros = await cargarLibritos(actor, filtro);
    if (libros.length === 0) return NextResponse.json({ error: "No hay librititos aprobados para descargar." }, { status: 400 });
    if (libros.length > MAX_LIBRITOS_POR_PDF_UNICO) {
      return NextResponse.json(
        {
          error: `El PDF único admite hasta ${MAX_LIBRITOS_POR_PDF_UNICO} librititos. Bajá el ZIP o armá lotes más chicos (por curso).`,
        },
        { status: 400 },
      );
    }
    const { bytes } = await pdfUnico(libros);
    const nombre = safeFilename(filtro.lote ?? "Librititos", "librititos");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return respuestaDeError(err, "pdf único");
  }
}
