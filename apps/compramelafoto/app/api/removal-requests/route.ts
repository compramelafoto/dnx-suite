import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeRemovalRequestBody } from "@/lib/public/removal-request";
import { crearSolicitudDeRemocion } from "@/lib/public/crear-solicitud-remocion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /api/removal-requests
 * Crea solicitud PENDING. No elimina fotos ni concede acceso.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `removal:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá más tarde." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = sanitizeRemovalRequestBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const resultado = await crearSolicitudDeRemocion(parsed.data);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json(
      {
        success: true,
        message: resultado.message,
        requestId: resultado.requestId,
        ...(resultado.duplicate ? { duplicate: true } : {}),
      },
      { status: resultado.status }
    );
  } catch (err: unknown) {
    console.error("POST /api/removal-requests ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
