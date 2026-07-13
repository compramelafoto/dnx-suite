import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  BULK_STATUS_MAX_IDS,
  canTransitionPrintOrderStatus,
  isAllowedPrintOrderStatus,
  PRINT_ORDER_STATUSES,
} from "@/lib/print-orders/print-order-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

export async function PATCH(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((n: unknown) => Number(n)).filter(Number.isFinite)
      : [];
    const status = String(body?.status || "").toUpperCase();
    const requesterType = body?.requesterType;
    const photographerId = body?.photographerId ? Number(body.photographerId) : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids vacío" }, { status: 400 });
    }
    if (ids.length > BULK_STATUS_MAX_IDS) {
      return NextResponse.json(
        { error: `Máximo ${BULK_STATUS_MAX_IDS} pedidos por solicitud`, max: BULK_STATUS_MAX_IDS },
        { status: 400 }
      );
    }
    if (!isAllowedPrintOrderStatus(status)) {
      return NextResponse.json(
        { error: "Estado inválido", allowed: [...PRINT_ORDER_STATUSES] },
        { status: 400 }
      );
    }

    if (user.role === Role.LAB || user.role === Role.LAB_PHOTOGRAPHER) {
      const lab = await prisma.lab.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!lab) {
        return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
      }
      const orders = await prisma.printOrder.findMany({
        where: { id: { in: ids } },
        select: { id: true, labId: true },
      });
      const invalidOrders = orders.filter((o) => o.labId !== lab.id);
      if (invalidOrders.length > 0) {
        return NextResponse.json(
          {
            error: "No podés modificar pedidos de otro laboratorio.",
            invalidIds: invalidOrders.map((o) => o.id),
          },
          { status: 403 }
        );
      }
    }

    if (user.role === Role.PHOTOGRAPHER || requesterType === "PHOTOGRAPHER") {
      const effectivePhotographerId =
        user.role === Role.PHOTOGRAPHER ? user.id : photographerId;
      const orders = await prisma.printOrder.findMany({
        where: { id: { in: ids } },
        select: { id: true, pickupBy: true, photographerId: true },
      });

      const invalidOrders = orders.filter(
        (o) =>
          o.pickupBy !== "PHOTOGRAPHER" ||
          !effectivePhotographerId ||
          o.photographerId !== effectivePhotographerId
      );

      if (invalidOrders.length > 0) {
        return NextResponse.json(
          {
            error:
              "No tenés permisos para modificar algunos pedidos. Solo podés modificar pedidos donde el fotógrafo retira.",
            invalidIds: invalidOrders.map((o) => o.id),
          },
          { status: 403 }
        );
      }
    }

    const ordersBeforeUpdate = await prisma.printOrder.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        pickupBy: true,
        photographerId: true,
        labId: true,
        status: true,
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

    const transitionErrors: Array<{ id: number; reason: string }> = [];
    for (const o of ordersBeforeUpdate) {
      const t = canTransitionPrintOrderStatus(o.status, status);
      if (!t.ok) {
        transitionErrors.push({ id: o.id, reason: t.reason });
      }
    }
    if (transitionErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Algunos pedidos no permiten la transición solicitada",
          invalid: transitionErrors,
        },
        { status: 400 }
      );
    }

    const updatedCount = await prisma.$transaction(async (tx) => {
      const result = await tx.printOrder.updateMany({
        where: { id: { in: ids } },
        data: {
          status: status as never,
          statusUpdatedAt: new Date(),
        },
      });

      const historyRows = ordersBeforeUpdate
        .filter((o) => o.status !== status)
        .map((o) => ({
          printOrderId: o.id,
          status: status as never,
          changedByUserId: user.id,
          notes: requesterType ? `bulk;requesterType=${requesterType}` : "bulk",
        }));

      if (historyRows.length > 0) {
        await tx.printOrderStatusHistory.createMany({ data: historyRows });
      }

      return result.count;
    });

    if (status === "READY" || status === "READY_TO_PICKUP") {
      const template = await getOrCreateTemplate("order_ready", {
        name: "Pedido listo",
        subject: "¡Tu pedido #{{orderId}} está listo!",
        bodyText: "",
        bodyHtml: "",
        variables: [],
      });
      const emailPromises = ordersBeforeUpdate
        .filter((o) => o.customerEmail)
        .map(async (order) => {
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

            await queueEmail({
              to: order.customerEmail!,
              subject: `¡Tu pedido #${order.id} está listo!`,
              body: `Hola ${customerName},

¡Buenas noticias! Tu pedido #${order.id} ya está listo.

${pickupInfo}
${order.lab?.phone ? `\nTeléfono del laboratorio: ${order.lab.phone}` : ""}

Ver pedido: ${orderUrl}

Saludos,
${labName}`,
              htmlBody: "",
              templateId: template.id,
              templateData: {
                customerName,
                orderId: order.id,
                pickupInfo,
                orderUrl,
              },
              idempotencyKey: `order_ready_${order.id}_${status}`,
            });
          } catch (emailErr: unknown) {
            console.error(`Error enviando email para pedido ${order.id}:`, emailErr);
          }
        });

      void Promise.all(emailPromises).catch((err) => {
        console.error("Error en envío masivo de emails:", err);
      });
    }

    return NextResponse.json({ ok: true, updated: updatedCount }, { status: 200 });
  } catch (err: unknown) {
    console.error("BULK STATUS ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error actualizando masivo",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
