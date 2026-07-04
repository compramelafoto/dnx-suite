import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

const ALLOWED = new Set([
  "CREATED",
  "IN_PRODUCTION",
  "READY",
  "READY_TO_PICKUP",
  "SHIPPED",
  "RETIRED",
  "DELIVERED",
  "CANCELED",
]);

export async function PATCH(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER, Role.PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((n: any) => Number(n)).filter(Number.isFinite) : [];
    const status = String(body?.status || "").toUpperCase();
    const requesterType = body?.requesterType; // "LAB" | "PHOTOGRAPHER"
    const photographerId = body?.photographerId ? Number(body.photographerId) : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids vacío" }, { status: 400 });
    }
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ error: "Estado inválido", allowed: Array.from(ALLOWED) }, { status: 400 });
    }

    // Si es LAB: solo puede actualizar pedidos con labId = su lab
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

    // Si es fotógrafo, validar permisos para cada pedido
    if (requesterType === "PHOTOGRAPHER") {
      const orders = await prisma.printOrder.findMany({
        where: { id: { in: ids } },
        select: { id: true, pickupBy: true, photographerId: true },
      });

      // Verificar que todos los pedidos sean del fotógrafo y tengan pickupBy = PHOTOGRAPHER
      const invalidOrders = orders.filter(
        (o) => o.pickupBy !== "PHOTOGRAPHER" || !photographerId || o.photographerId !== photographerId
      );

      if (invalidOrders.length > 0) {
        return NextResponse.json(
          {
            error: "No tenés permisos para modificar algunos pedidos. Solo podés modificar pedidos donde el fotógrafo retira.",
            invalidIds: invalidOrders.map((o) => o.id),
          },
          { status: 403 }
        );
      }
    }
    // Si es LAB o no se especifica, permitimos (por compatibilidad con el panel del lab)

    // Obtener datos de los pedidos antes de actualizar para notificaciones
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

    const result = await prisma.printOrder.updateMany({
      where: { id: { in: ids } },
      data: { 
        status: status as any, // Cast necesario porque Prisma espera el enum específico
        statusUpdatedAt: new Date() 
      },
    });

    // Enviar notificaciones por email si cambió a READY o READY_TO_PICKUP
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
            // Determinar dirección de retiro
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
          } catch (emailErr: any) {
            // No fallar la actualización si el email falla, solo loguear
            console.error(`Error enviando email para pedido ${order.id}:`, emailErr);
          }
        });

      // Enviar emails en paralelo (no esperar a que terminen todos)
      Promise.all(emailPromises).catch((err) => {
        console.error("Error en envío masivo de emails:", err);
      });
    }

    return NextResponse.json({ ok: true, updated: result.count }, { status: 200 });
  } catch (err: any) {
    console.error("BULK STATUS ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando masivo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
