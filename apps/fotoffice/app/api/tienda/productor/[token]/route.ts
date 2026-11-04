import { NextResponse } from "next/server";
import { loadFeedByToken } from "@/lib/store/fulfillment/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La planilla de pedidos de un productor (dropshipping), en CSV, por enlace secreto. Sin sesión: la
 * pide Google Sheets con `=IMPORTDATA("…/api/tienda/productor/<token>.csv")`, más o menos una
 * vez por hora. Acepta el enlace con o sin `.csv` al final.
 *
 * Un enlace que no es de nadie responde 404 igual que uno mal escrito: no se distingue.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: crudo } = await params;
  const token = crudo.endsWith(".csv") ? crudo.slice(0, -4) : crudo;
  const feed = await loadFeedByToken(token);
  if (!feed) {
    return new NextResponse("No encontrado", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  // `?descargar=1` es el botón «Descargar CSV» del panel; Google Sheets lo pide sin eso.
  const descargar = new URL(req.url).searchParams.get("descargar") === "1";
  return new NextResponse(feed.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="pedidos.csv"`,
      "Cache-Control": "no-store",
      // El enlace es secreto: que no quede en buscadores ni se pase en el Referer.
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
