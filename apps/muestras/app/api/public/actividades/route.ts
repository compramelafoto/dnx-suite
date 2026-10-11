import { NextResponse } from "next/server";
import { listarExportables } from "@/lib/actividades/exportables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://muestrasfotograficas.com";

/**
 * Las actividades publicadas, para que otras plataformas de la suite las difundan (InfoSpot las
 * lee una vez por semana). Público y sin sesión: sólo lleva lo que ya se ve en cada página.
 * La CDN la guarda 10 minutos.
 */
export async function GET() {
  try {
    const cuerpo = await listarExportables(BASE);
    return NextResponse.json(cuerpo, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("GET /api/public/actividades:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos armar la lista." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
