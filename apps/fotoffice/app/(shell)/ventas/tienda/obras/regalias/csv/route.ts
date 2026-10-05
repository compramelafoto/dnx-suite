import { NextResponse, type NextRequest } from "next/server";
import { requireStoreConfigurer } from "@/lib/store/access";
import { loadRoyaltyMonth } from "@/lib/store/artworks/royalties";
import { buildRoyaltiesCsv, parseRoyaltyMonth } from "@/lib/store/artworks/royalty-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV de las regalías de un mes (hora argentina). Mismo permiso que la pantalla; el workspace
 * sale de la sesión, de la URL sólo el mes (validado). Lleva emails de autores: sin caché.
 */
export async function GET(req: NextRequest) {
  const { workspace } = await requireStoreConfigurer();
  const month = parseRoyaltyMonth(req.nextUrl.searchParams.get("mes"));
  const csv = buildRoyaltiesCsv(await loadRoyaltyMonth(workspace.id, month), month);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // `month` es AAAA-MM validado: no puede inyectar cabeceras.
      "Content-Disposition": `attachment; filename="regalias-${month}.csv"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
