import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  canTransitionPrintOrderStatus,
  isAllowedPrintOrderStatus,
  PRINT_ORDER_STATUSES,
} from "@/lib/print-orders/print-order-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

function parseId(raw: unknown): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([
      Role.LAB,
      Role.LAB_PHOTOGRAPHER,
      Role.PHOTOGRAPHER,
      Role.ADMIN,
    ]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const params = await Promise.resolve((ctx as { params: Promise<{ id: string }> }).params);
    const orderId = parseId(params?.id);

    if (!orderId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        pickupBy: true,
        photographerId: true,
        labId: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        lab: {
          select: {
            name: true,
            address: true,
            phone: true,
          },
        },
        photographer: {
          select: {
            name: true,
            address: true,
            companyAddress: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "").toUpperCase();
    const requesterType = body?.requesterType; // "LAB" | "PHOTOGRAPHER"
    const photographerId = body?.photographerId ? Number(body.photographerId) : null;

    if (!isAllowedPrintOrderStatus(status)) {
      return NextResponse.json(
        { error: "Estado inválido", allowed: [...PRINT_ORDER_STATUSES] },
        { status: 400 }
      );
    }

    const transition = canTransitionPrintOrderStatus(order.status, status);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: 400 });
    }

    // LAB: solo su laboratorio
    if (user.role === Role.LAB || user.role === Role.LAB_PHOTOGRAPHER) {
      const lab = await prisma.lab.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!lab || order.labId !== lab.id) {
        return NextResponse.json(
          { error: "No tenés permisos para modificar este pedido." },
          { status: 403 }
        );
      }
    }

    // PHOTOGRAPHER: solo propios con pickupBy PHOTOGRAPHER
    if (user.role === Role.PHOTOGRAPHER || requesterType === "PHOTOGRAPHER") {
      if (user.role === Role.PHOTOGRAPHER) {
        if (order.pickupBy !== "PHOTOGRAPHER" || order.photographerId !== user.id) {
          return NextResponse.json(
            {
              error:
                "No tenés permisos para modificar este pedido. Solo podés modificar pedidos donde el fotógrafo retira.",
            },
            { status: 403 }
          );
        }
      } else if (requesterType === "PHOTOGRAPHER") {
        if (order.pickupBy !== "PHOTOGRAPHER") {
          return NextResponse.json(
            {
              error:
                "No tenés permisos para modificar este pedido. Solo podés modificar pedidos donde el fotógrafo retira.",
            },
            { status: 403 }
          );
        }
        if (!photographerId || !order.photographerId || photographerId !== order.photographerId) {
          return NextResponse.json(
            {
              error:
                "No tenés permisos para modificar este pedido. Solo podés modificar tus propios pedidos.",
            },
            { status: 403 }
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.printOrder.update({
        where: { id: orderId },
        data: {
          status: status as never,
          statusUpdatedAt: new Date(),
        },
      });
      if (order.status !== status) {
        await tx.printOrderStatusHistory.create({
          data: {
            printOrderId: orderId,
            status: status as never,
            changedByUserId: user.id,
            notes: requesterType ? `requesterType=${requesterType}` : null,
          },
        });
      }
      return next;
    });

    if ((status === "READY" || status === "READY_TO_PICKUP") && order.customerEmail) {
      try {
        let pickupAddress = "";
        if (order.pickupBy === "CLIENT") {
          pickupAddress = order.lab?.address || "el laboratorio";
        } else if (order.pickupBy === "PHOTOGRAPHER") {
          pickupAddress =
            order.photographer?.companyAddress ||
            order.photographer?.address ||
            "el fotógrafo";
        }

        const customerName = order.customerName || "Cliente";
        const labName = order.lab?.name || "el laboratorio";
        const pickupInfo =
          order.pickupBy === "CLIENT"
            ? `Podés retirarlo en ${pickupAddress}. Si necesitás coordinar el retiro o la entrega, contactanos.`
            : "Coordiná el retiro o la entrega con el fotógrafo o el laboratorio según corresponda.";
        const orderUrl = `${APP_URL}/cliente/pedidos`;
        const template = await getOrCreateTemplate("order_ready", {
          name: "Pedido listo",
          subject: "¡Tu pedido #{{orderId}} está listo!",
          bodyText: "",
          bodyHtml: "",
          variables: [],
        });

        await queueEmail({
          to: order.customerEmail,
          subject: `¡Tu pedido #${orderId} está listo!`,
          body: `Hola ${customerName},

¡Buenas noticias! Tu pedido #${orderId} ya está listo.

${pickupInfo}
${order.lab?.phone ? `\nTeléfono del laboratorio: ${order.lab.phone}` : ""}

Ver pedido: ${orderUrl}

Saludos,
${labName}`,
          htmlBody: "",
          templateId: template.id,
          templateData: {
            customerName,
            orderId,
            pickupInfo,
            orderUrl,
          },
          idempotencyKey: `order_ready_${orderId}_${status}`,
        });
      } catch (emailErr: unknown) {
        console.error("Error enviando email de notificación:", emailErr);
      }
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: unknown) {
    console.error("UPDATE STATUS ERROR >>>", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("RETIRED") || errorMessage.includes("Invalid enum value")) {
      return NextResponse.json(
        {
          error:
            "El estado solicitado no está disponible en la base de datos. Revisá migraciones de PrintOrderStatus.",
          detail: errorMessage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando estado", detail: errorMessage },
      { status: 500 }
    );
  }
}
