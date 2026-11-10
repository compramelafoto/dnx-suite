import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { bearerDe, secretoCoincide } from "@/lib/fotoffice-conexion/llaves";
import { canjearCodigo } from "@/lib/fotoffice-conexion/servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * POST /api/integraciones/fotoffice/v1/canjear
 * FOTOFFICE canjea, de servidor a servidor, el código de un solo uso por una llave de acceso.
 * `Authorization: Bearer <DNX_CLF_FOTOFFICE_CLIENT_SECRET>` y cuerpo `{ code }`.
 * 200 `{ llave, cuenta: { id, nombre, mpUserId } }` · 400 código usado/vencido · 401 secreto malo · 503 sin configurar.
 */
export async function POST(req: NextRequest) {
  const secreto = process.env.DNX_CLF_FOTOFFICE_CLIENT_SECRET?.trim();
  if (!secreto) return NextResponse.json({ error: "no_configurada" }, { status: 503, headers: SIN_CACHE });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  if (!checkRateLimit({ key: `fotoffice-canjear:${ip}`, limit: 30, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: "demasiados_pedidos" }, { status: 429, headers: SIN_CACHE });
  }

  if (!secretoCoincide(bearerDe(req.headers.get("authorization")) ?? "", secreto)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401, headers: SIN_CACHE });
  }

  let code: unknown = null;
  try {
    code = ((await req.json()) as { code?: unknown })?.code;
  } catch {
    code = null;
  }
  if (typeof code !== "string" || !code || code.length > 100) {
    return NextResponse.json({ error: "codigo_invalido" }, { status: 400, headers: SIN_CACHE });
  }

  try {
    const r = await canjearCodigo(code);
    if (!r) return NextResponse.json({ error: "codigo_invalido" }, { status: 400, headers: SIN_CACHE });
    return NextResponse.json(r, { headers: SIN_CACHE });
  } catch (error) {
    console.error("POST /api/integraciones/fotoffice/v1/canjear", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "error_interno" }, { status: 500, headers: SIN_CACHE });
  }
}
