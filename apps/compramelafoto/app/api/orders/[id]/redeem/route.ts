/**
 * POST /api/orders/[id]/redeem
 *
 * Canje V1: Order PREVENTA_PACK pagado → Order PACK_REDEMPTION (transacción serializable).
 * Requiere sesión de cliente y titularidad del pedido preventa.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderOrigin, OrderStatus, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/order-claims";
import {
  executePreventaPackRedeemV1,
  PreventaPackRedeemValidationError,
} from "@/lib/preventa-canjeable/redeem-preventa-pack-order-v1";
import { Prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  selections: z
    .array(
      z.object({
        benefitStableKey: z.string().min(1),
        units: z.array(z.array(z.number().int().positive())),
      })
    )
    .min(1),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.CUSTOMER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const preventaOrderId = parseInt(id, 10);
    if (!Number.isFinite(preventaOrderId) || preventaOrderId <= 0) {
      return NextResponse.json(
        { error: "ID de pedido inválido" },
        { status: 400 }
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body inválido", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const parent = await prisma.order.findUnique({
      where: { id: preventaOrderId },
      select: {
        id: true,
        buyerUserId: true,
        buyerEmail: true,
        origin: true,
        status: true,
        redemptionOrderId: true,
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (parent.origin !== OrderOrigin.PREVENTA_PACK) {
      return NextResponse.json(
        { error: "Este pedido no es un pack de preventa" },
        { status: 400 }
      );
    }
    if (parent.status !== OrderStatus.PAID) {
      return NextResponse.json(
        { error: "El pedido debe estar pagado para canjear" },
        { status: 400 }
      );
    }
    if (parent.redemptionOrderId != null) {
      return NextResponse.json(
        { error: "Este pack ya fue canjeado" },
        { status: 409 }
      );
    }

    const userEmailNorm = user.email ? normalizeEmail(user.email) : "";
    const orderEmailNorm = parent.buyerEmail
      ? normalizeEmail(parent.buyerEmail)
      : "";
    const isOwner =
      parent.buyerUserId === user.id ||
      (parent.buyerUserId == null &&
        !!user.emailVerifiedAt &&
        userEmailNorm &&
        userEmailNorm === orderEmailNorm);

    if (!isOwner) {
      return NextResponse.json(
        { error: "No tenés acceso a este pedido" },
        { status: 403 }
      );
    }

    const result = await executePreventaPackRedeemV1(preventaOrderId, parsed.data.selections);

    return NextResponse.json(
      { redemptionOrderId: result.redemptionOrderId },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof PreventaPackRedeemValidationError) {
      return NextResponse.json(
        {
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
        },
        { status: err.httpStatus ?? 400 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2034") {
        return NextResponse.json(
          { error: "Conflicto al canjear; reintentá en unos segundos" },
          { status: 409 }
        );
      }
    }
    console.error("POST /api/orders/[id]/redeem", err);
    return NextResponse.json(
      { error: "Error al procesar el canje" },
      { status: 500 }
    );
  }
}
