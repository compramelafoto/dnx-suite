import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { crearSolicitudDePrivacidad, privacyRequestSchema } from "@/lib/privacy/crear-solicitud-privacidad";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  const rate = checkRateLimit({ key: `privacy-request:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = privacyRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat().join("; ") || "Datos inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const request = await crearSolicitudDePrivacidad(parsed.data, {
    ip,
    userAgent,
    sourcePage: req.headers.get("referer") || "",
  });

  return NextResponse.json({
    success: true,
    ticketId: request.id,
    message: `Solicitud recibida. Ticket #${request.id}. Revisá tu email para la confirmación.`,
  });
}
