import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { cargarEntregaPorQr, marcarEntregaPorQr, TITULO_PASO, type AccionDeEntrega } from "@/lib/school-fulfillment/entrega-por-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ codigo: string }> };

/**
 * POST { accion: "LISTO" | "ENTREGADO" } — mueve el pedido del QR.
 *
 * - "LISTO" (impreso y en la escuela): sólo el fotógrafo dueño del álbum (o un admin), con sesión.
 * - "ENTREGADO": el fotógrafo, o quien lo recibe (padre, escuela) con «Confirmar que lo recibí».
 *   Es un botón y no se marca al abrir el enlace: WhatsApp y los lectores de QR abren los enlaces
 *   solos para armar la vista previa, y eso marcaría entregados pedidos que nadie recibió.
 */
export async function POST(req: NextRequest, context: Ctx) {
  const { codigo } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { accion?: unknown };
  const accion: AccionDeEntrega | null = body.accion === "LISTO" || body.accion === "ENTREGADO" ? body.accion : null;
  if (!accion) return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const limite = checkRateLimit({ key: `entrega-qr:${ip}`, limit: 30, windowMs: 60_000 });
  if (!limite.allowed) {
    return NextResponse.json({ ok: false, error: "Demasiados intentos. Probá en un minuto." }, { status: 429 });
  }

  const entrega = await cargarEntregaPorQr(decodeURIComponent(codigo));
  if (!entrega) return NextResponse.json({ ok: false, error: "No encontramos ese pedido." }, { status: 404 });

  const auth = await getAuthUser();
  const esFotografo = auth != null && (auth.role === Role.ADMIN || auth.id === entrega.fotografoId);
  if (accion === "LISTO" && !esFotografo) {
    return NextResponse.json({ ok: false, error: "Sólo el fotógrafo puede marcarlo listo para entregar." }, { status: 403 });
  }
  const hecho = await marcarEntregaPorQr(entrega, accion);
  if (!hecho) {
    return NextResponse.json(
      { ok: false, error: `El pedido está en «${TITULO_PASO(entrega.paso)}»: no se puede marcar así.` },
      { status: 409 },
    );
  }
  const actualizado = await cargarEntregaPorQr(decodeURIComponent(codigo));
  return NextResponse.json({ ok: true, paso: actualizado?.paso ?? null });
}
