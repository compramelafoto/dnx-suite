import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { resolveOrderClientViewLinks } from "@/lib/admin/order-client-view-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const baseUrl =
      process.env.APP_URL ||
      (typeof req.url === "string" ? req.url.split("/api")[0] : "") ||
      "";

    const links = await resolveOrderClientViewLinks(orderId, baseUrl);
    if (!links) {
      return NextResponse.json(
        { error: "No hay fotos digitales disponibles para este pedido" },
        { status: 404 }
      );
    }

    return NextResponse.json(links);
  } catch (err: unknown) {
    console.error("[admin/client-view-link] Error:", err);
    return NextResponse.json(
      { error: "Error obteniendo link de visualización del cliente" },
      { status: 500 }
    );
  }
}
