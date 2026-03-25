import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";

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



function parseId(raw: any): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params: any = await Promise.resolve((ctx as any).params);
    const orderId = parseId(params?.id);

    if (!orderId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obtener el pedido para verificar permisos
    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: { pickupBy: true, photographerId: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "").toUpperCase();
    const requesterType = body?.requesterType; // "LAB" | "PHOTOGRAPHER"
    const photographerId = body?.photographerId ? Number(body.photographerId) : null;

    if (!ALLOWED.has(status)) {
      return NextResponse.json(
        { error: "Estado inválido", allowed: Array.from(ALLOWED) },
        { status: 400 }
      );
    }

    // Validar permisos:
    // - LAB siempre puede modificar
    // - PHOTOGRAPHER solo puede modificar si pickupBy = PHOTOGRAPHER y es el fotógrafo del pedido
    if (requesterType === "PHOTOGRAPHER") {
      if (order.pickupBy !== "PHOTOGRAPHER") {
        return NextResponse.json(
          { error: "No tenés permisos para modificar este pedido. Solo podés modificar pedidos donde el fotógrafo retira." },
          { status: 403 }
        );
      }

      if (!photographerId || !order.photographerId || photographerId !== order.photographerId) {
        return NextResponse.json(
          { error: "No tenés permisos para modificar este pedido. Solo podés modificar tus propios pedidos." },
          { status: 403 }
        );
      }
    }
    // Si requesterType es "LAB" o no se especifica, permitimos (por compatibilidad con el panel del lab)

    // Obtener datos completos del pedido para notificaciones
    const orderBeforeUpdate = await prisma.printOrder.findUnique({
      where: { id: orderId },
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

    if (!orderBeforeUpdate) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // ✅ IMPORTANTE: además de status, actualizamos statusUpdatedAt
    const updated = await prisma.printOrder.update({
      where: { id: orderId },
      data: { 
        status: status as any, // Cast necesario porque Prisma espera el enum específico
        statusUpdatedAt: new Date() 
      },
    });

    // Enviar notificación por email si cambió a READY o READY_TO_PICKUP
    if ((status === "READY" || status === "READY_TO_PICKUP") && orderBeforeUpdate.customerEmail) {
      try {
        // Determinar dirección de retiro
        let pickupAddress = "";
        if (orderBeforeUpdate.pickupBy === "CLIENT") {
          pickupAddress = orderBeforeUpdate.lab?.address || "el laboratorio";
        } else if (orderBeforeUpdate.pickupBy === "PHOTOGRAPHER") {
          pickupAddress = 
            orderBeforeUpdate.photographer?.companyAddress || 
            orderBeforeUpdate.photographer?.address || 
            "el fotógrafo";
        }

        const customerName = orderBeforeUpdate.customerName || "Cliente";
        const labName = orderBeforeUpdate.lab?.name || "el laboratorio";
        const pickupInfo =
          orderBeforeUpdate.pickupBy === "CLIENT"
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
          to: orderBeforeUpdate.customerEmail,
          subject: `¡Tu pedido #${orderId} está listo!`,
          body: `Hola ${customerName},

¡Buenas noticias! Tu pedido #${orderId} ya está listo.

${pickupInfo}
${orderBeforeUpdate.lab?.phone ? `\nTeléfono del laboratorio: ${orderBeforeUpdate.lab.phone}` : ""}

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
      } catch (emailErr: any) {
        // No fallar la actualización si el email falla, solo loguear
        console.error("Error enviando email de notificación:", emailErr);
      }
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("UPDATE STATUS ERROR >>>", err);
    
    // Verificar si el error es porque el estado no existe en el enum de la base de datos
    const errorMessage = String(err?.message ?? err);
    if (errorMessage.includes("RETIRED") || errorMessage.includes("Invalid enum value")) {
      return NextResponse.json(
        { 
          error: "El estado RETIRED aún no está disponible en la base de datos. Por favor, ejecutá la migración de Prisma: npx prisma migrate dev",
          detail: errorMessage
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
