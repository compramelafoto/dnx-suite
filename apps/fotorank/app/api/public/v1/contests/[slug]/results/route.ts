import { NextResponse } from "next/server";
import { getPublicResultsPayload } from "../../../../../../lib/fotorank/results/public-results-payload";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Resultados públicos sanitizados.
 * Antes de LIVE: 404 seguro sin filtrar ranking privado.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const payload = await getPublicResultsPayload({ contestSlug: slug });

  if (!payload.published) {
    return NextResponse.json(
      {
        published: false,
        message: "Resultados todavía no publicados",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, noarchive",
        },
      },
    );
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": payload.stagingTest ? "no-store" : "public, max-age=60",
      "X-Robots-Tag": payload.stagingTest ? "noindex, noarchive" : "index",
    },
  });
}
