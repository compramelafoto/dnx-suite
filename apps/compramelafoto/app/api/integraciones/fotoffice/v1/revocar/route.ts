import { NextRequest, NextResponse } from "next/server";
import { bearerDe } from "@/lib/fotoffice-conexion/llaves";
import { revocarLlave } from "@/lib/fotoffice-conexion/servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * POST /api/integraciones/fotoffice/v1/revocar
 * FOTOFFICE avisa que desconectó: `Authorization: Bearer <llave>`. Responde 200 aunque la llave ya estuviera
 * revocada o no exista (no deja averiguar qué llaves existen).
 */
export async function POST(req: NextRequest) {
  const llave = bearerDe(req.headers.get("authorization"));
  if (!llave) return NextResponse.json({ error: "no_autorizado" }, { status: 401, headers: SIN_CACHE });
  try {
    await revocarLlave(llave);
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE });
  } catch (error) {
    console.error("POST /api/integraciones/fotoffice/v1/revocar", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "error_interno" }, { status: 500, headers: SIN_CACHE });
  }
}
