import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { bearerDe, hashSecreto } from "@/lib/fotoffice-conexion/llaves";
import { usuarioDeLlave } from "@/lib/fotoffice-conexion/servicio";
import { leerVentas } from "@/lib/fotoffice-conexion/ventas-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * GET /api/integraciones/fotoffice/v1/ventas?cursor=
 * Ventas del fotógrafo dueño de la llave (`Authorization: Bearer <llave>`), de a 200, por (updatedAt, id).
 * 200 `{ ventas, siguiente, hayMas }` · 401 sin llave válida · 400 cursor inválido · 429 más de 60 por minuto.
 * Sólo álbumes de esa cuenta y sólo los campos de `VentaFotoffice` (lib/fotoffice-conexion/ventas.ts).
 */
export async function GET(req: NextRequest) {
  const llave = bearerDe(req.headers.get("authorization"));
  if (!llave) return NextResponse.json({ error: "no_autorizado" }, { status: 401, headers: SIN_CACHE });

  if (!checkRateLimit({ key: `fotoffice-ventas:${hashSecreto(llave)}`, limit: 60, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: "demasiados_pedidos" }, { status: 429, headers: SIN_CACHE });
  }

  try {
    const dueno = await usuarioDeLlave(llave);
    if (!dueno) return NextResponse.json({ error: "no_autorizado" }, { status: 401, headers: SIN_CACHE });

    const cursor = req.nextUrl.searchParams.get("cursor")?.trim() || null;
    const r = await leerVentas(dueno.userId, cursor);
    if ("error" in r) return NextResponse.json({ error: "cursor_invalido" }, { status: 400, headers: SIN_CACHE });
    return NextResponse.json(r, { headers: SIN_CACHE });
  } catch (error) {
    console.error("GET /api/integraciones/fotoffice/v1/ventas", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "error_interno" }, { status: 500, headers: SIN_CACHE });
  }
}
