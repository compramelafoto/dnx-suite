import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { parseCourseExternalReference } from "@/lib/presential-courses/checkout";
import { approveCourseEnrollment } from "@/lib/presential-courses/enrollment-workflow";
import { logCourseEvent } from "@/lib/presential-courses/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aviso de Mercado Pago sobre el pago de una inscripción a un curso.
 *
 * **Siempre responde 200**, incluso cuando no puede aplicarlo: devolver un error hace que
 * Mercado Pago reintente durante días, y el problema casi nunca se arregla reintentando.
 *
 * **No se confía en el cuerpo del aviso.** Trae un identificador y nada más; el estado y a qué
 * inscripción corresponde se le preguntan a Mercado Pago con el token de la institución. Un
 * cuerpo falsificado no puede acreditar un pago que no existe — por eso este webhook no
 * necesita ningún secreto de firma, que es lo que tenía trabado al anterior: exigía
 * `MP_WEBHOOK_SECRET`, una variable que nunca se cargó, y en producción rechazaba todo con 401.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cuerpo = await request.json().catch(() => null);
  const providerPaymentId = extractPaymentId(cuerpo, url);
  if (!providerPaymentId) {
    return NextResponse.json({ ok: true, applied: false, motivo: "sin identificador de pago" });
  }

  try {
    // Ya acreditado: no hace falta volver a preguntarle a Mercado Pago.
    const yaPago = await prisma.courseEnrollment.findFirst({
      where: { paymentRef: providerPaymentId, paymentStatus: "APPROVED" },
      select: { id: true },
    });
    if (yaPago) {
      return NextResponse.json({ ok: true, applied: false, motivo: "aviso repetido" });
    }

    // Para consultar el pago hace falta el token de alguna institución. Se resuelve por las
    // inscripciones que esperan pago: son las únicas que pueden corresponder a este aviso.
    const esperando = await prisma.courseEnrollment.findMany({
      where: { paymentStatus: "PENDING" },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    if (esperando.length === 0) {
      return NextResponse.json({
        ok: true,
        applied: false,
        motivo: "sin inscripciones esperando pago",
      });
    }

    for (const { workspaceId } of esperando) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;

      const adapter = createMercadoPagoCheckoutProLiveAdapter({
        accessToken: collector.collector.accessToken,
      });
      let pago;
      try {
        pago = await adapter.getPayment(providerPaymentId);
      } catch {
        // Ese pago no es de esta institución, o su token no alcanza. Se prueba con la
        // siguiente en vez de dar el aviso por perdido.
        continue;
      }

      const enrollmentId = parseCourseExternalReference(pago.externalReference ?? "");
      if (!enrollmentId) {
        // Es un pago de otra cosa —una cuota, una reserva—: no es de este webhook.
        return NextResponse.json({ ok: true, applied: false, motivo: "no es un curso" });
      }

      const estado = String(
        (pago.rawSanitized as Record<string, unknown>).status ?? pago.status,
      );

      if (estado === "approved") {
        const r = await approveCourseEnrollment({
          enrollmentId,
          paymentRef: providerPaymentId,
          amountArs: pago.amountMinor != null ? pago.amountMinor / 100 : undefined,
        });
        return NextResponse.json({ ...r, applied: r.ok });
      }

      if (estado === "rejected" || estado === "cancelled") {
        await prisma.courseEnrollment.updateMany({
          where: { id: enrollmentId, paymentStatus: "PENDING" },
          data: {
            paymentStatus: estado === "rejected" ? "REJECTED" : "CANCELLED",
            paymentRef: providerPaymentId,
          },
        });
        logCourseEvent("payment_not_approved", { enrollmentId, providerPaymentId, estado });
        return NextResponse.json({ ok: true, applied: true, motivo: `estado ${estado}` });
      }

      return NextResponse.json({ ok: true, applied: false, motivo: `estado ${estado}` });
    }

    return NextResponse.json({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
  } catch (error) {
    console.error("[fotoffice][cursos] falló el aviso de Mercado Pago", {
      providerPaymentId,
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "no se pudo aplicar" }, { status: 200 });
  }
}

/** Mercado Pago también avisa por GET en algunas configuraciones. Mismo camino. */
export async function GET(request: Request) {
  return POST(request);
}
