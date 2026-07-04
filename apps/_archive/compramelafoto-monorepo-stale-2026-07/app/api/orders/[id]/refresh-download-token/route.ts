/**
 * POST /api/orders/[id]/refresh-download-token
 *
 * Genera un nuevo token de descarga para el pedido digital (Order) y devuelve la URL.
 * Requiere sesión de cliente y que el pedido pertenezca al usuario (buyerUserId o buyerEmail verificado).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClientDownloadToken } from "@/lib/download-tokens";
import { getAppConfig } from "@/lib/services/settingsService";
import { normalizeEmail } from "@/lib/order-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.CUSTOMER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(ctx.params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "ID de pedido inválido" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        albumId: true,
        buyerUserId: true,
        buyerEmail: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const userEmailNorm = user.email ? normalizeEmail(user.email) : "";
    const orderEmailNorm = order.buyerEmail ? normalizeEmail(order.buyerEmail) : "";
    const isOwner =
      order.buyerUserId === user.id ||
      (order.buyerUserId == null &&
        !!user.emailVerifiedAt &&
        userEmailNorm &&
        userEmailNorm === orderEmailNorm);

    if (!isOwner) {
      return NextResponse.json(
        { error: "No tenés acceso a este pedido" },
        { status: 403 }
      );
    }

    if (order.status !== "PAID") {
      return NextResponse.json(
        { error: "El pedido debe estar pagado para descargar" },
        { status: 400 }
      );
    }

    const config = await getAppConfig();
    const downloadDays = Number(config?.downloadLinkDays ?? 30) || 30;
    const expiresAt = new Date(
      Date.now() + downloadDays * 24 * 60 * 60 * 1000
    );

    const token = await createClientDownloadToken({
      orderId: order.id,
      albumId: order.albumId,
      expiresAt,
    });

    const baseUrl =
      process.env.APP_URL ||
      (typeof req.url === "string" ? req.url.split("/api")[0] : "") ||
      "";
    const downloadUrl = `${baseUrl}/api/downloads/${token}`;

    return NextResponse.json({
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("[refresh-download-token] Error:", err);
    return NextResponse.json(
      { error: "Error generando link de descarga", detail: String((err as Error)?.message) },
      { status: 500 }
    );
  }
}
