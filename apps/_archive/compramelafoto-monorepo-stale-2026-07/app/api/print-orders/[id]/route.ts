/**
 * GET /api/print-orders/[id]
 *
 * Dos modos:
 * 1. Sin auth (confirmación pública): devuelve solo datos mínimos para la página de confirmación
 *    (id, total, status, paymentStatus, mpInitPoint, currency, resumen de items sin fileKey)
 * 2. Con auth (fotógrafo/lab/admin): sanitiza según rol y estado de pago.
 *    - Lab: solo ve si paymentStatus === PAID
 *    - Fotógrafo: ve pedidos propios; datos sensibles solo si PAID
 *    - Admin: ve todo
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  getOrderVisibilityContext,
  sanitizeOrderForRole,
  registerAuditEvent,
  getRequestMetadata,
} from "@/lib/antifraud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: unknown): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/** Respuesta mínima para confirmación pública (sin auth). Sin datos sensibles del cliente. */
function toPublicConfirmationResponse(order: {
  id: number;
  total: number;
  status: string;
  paymentStatus: string | null;
  mpInitPoint: string | null;
  currency: string;
  createdAt: Date;
  items: Array<{ id: number; size: string; acabado: string; quantity: number }>;
  lab: { id: number; name: string; address: string | null; phone: string | null; city: string | null; province: string | null } | null;
  photographer: { id: number; name: string | null; address: string | null; companyAddress: string | null } | null;
}) {
  return {
    id: order.id,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    mpInitPoint: order.mpInitPoint,
    currency: order.currency,
    createdAt: order.createdAt,
    lab: order.lab
      ? {
          id: order.lab.id,
          name: order.lab.name,
          address: order.lab.address,
          phone: order.lab.phone,
          city: order.lab.city,
          province: order.lab.province,
        }
      : null,
    photographer: order.photographer
      ? {
          id: order.photographer.id,
          name: order.photographer.name,
          address: order.photographer.address ?? order.photographer.companyAddress,
        }
      : null,
    items: order.items.map((it: { id: number; size: string; acabado: string; quantity: number }) => ({
      id: it.id,
      size: it.size,
      acabado: it.acabado,
      quantity: it.quantity,
    })),
  };
}

export async function GET(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve((ctx as { params: Promise<{ id: string }> }).params);
    const orderId = parseId(params?.id);

    if (!orderId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      include: {
        lab: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            city: true,
            province: true,
          },
        },
        photographer: {
          select: {
            id: true,
            name: true,
            address: true,
            companyAddress: true,
            phone: true,
          },
        },
        items: {
          select: {
            id: true,
            fileKey: true,
            originalName: true,
            size: true,
            acabado: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const user = await getAuthUser();

    // Modo público: confirmación post-pago (cliente sin auth)
    if (!user) {
      return NextResponse.json(toPublicConfirmationResponse(order as any), { status: 200 });
    }

    // Modo autenticado: verificar visibilidad por rol
    const labId = user.role === "LAB" || user.role === "LAB_PHOTOGRAPHER" ? user.labId : undefined;
    const visibilityUser = {
      id: user.id,
      role: user.role,
      labId,
    };

    const ctx2 = getOrderVisibilityContext(visibilityUser, {
      orderType: "PRINT_ORDER",
      paymentStatus: order.paymentStatus ?? undefined,
      status: order.status,
      photographerId: order.photographerId,
      labId: order.labId,
    });

    // Lab: no puede ver pedidos no pagados
    if (!ctx2.canViewOrder) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Registrar auditoría si fotógrafo o lab abre el pedido
    const { ipAddress, userAgent } = getRequestMetadata(req);
    if (user.role === "PHOTOGRAPHER" || user.role === "LAB_PHOTOGRAPHER") {
      await registerAuditEvent({
        actorUserId: user.id,
        actorRole: user.role,
        targetOrderType: "PRINT_ORDER",
        targetOrderId: orderId,
        eventType: "ORDER_VIEWED_PHOTOGRAPHER",
        ipAddress,
        userAgent,
      });
    } else if (user.role === "LAB") {
      await registerAuditEvent({
        actorUserId: user.id,
        actorRole: user.role,
        targetOrderType: "PRINT_ORDER",
        targetOrderId: orderId,
        eventType: "ORDER_VIEWED_LAB",
        ipAddress,
        userAgent,
      });
    }

    const sanitized = sanitizeOrderForRole(order as Record<string, unknown>, ctx2, {
      includeItems: true,
    });

    return NextResponse.json(sanitized, { status: 200 });
  } catch (err: unknown) {
    console.error("GET /api/print-orders/[id] ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo pedido",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
