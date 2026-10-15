import { NextResponse, type NextRequest } from "next/server";
import { hostWithoutPort } from "@/lib/website/domain/normalize";
import { slugForCustomDomain } from "@/lib/website/domain/lookup";

/**
 * ¿De qué institución es este dominio? Responde `{ slug }` (null si no es de nadie).
 *
 * Existe para que el `proxy.ts` no cargue Prisma: el proxy corre antes de cada visita y, si
 * fallara al cargar, se caería la aplicación entera. Acá un error sólo deja sin resolver un
 * dominio propio. Es pública: decir qué slug tiene un dominio no revela nada que el propio
 * sitio no muestre.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const domain = hostWithoutPort(req.nextUrl.searchParams.get("domain") ?? "").slice(0, 253);
  const slug = domain ? await slugForCustomDomain(domain) : null;
  return NextResponse.json({ slug }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
