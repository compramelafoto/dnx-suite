import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "./availability";
import { logCourseEvent } from "./log";

/**
 * El cobro de una inscripción a un curso.
 *
 * **Cobra la institución, no la plataforma.** El token sale de la cuenta que el workspace
 * conectó por OAuth (`resolveWorkspaceCollector`) y la comisión se retiene en la misma
 * operación con `marketplaceFeeMinor`. Es el mismo camino que `lib/bookings/checkout.ts`:
 * hasta el 2026-09-21 Cursos creaba la preferencia con un token único de plataforma, con lo
 * cual el dinero entraba a DNX y el neto de la institución era apenas un número anotado.
 */

const PREFIJO = "fotoffice-curso:";

/** Cómo viaja la inscripción dentro del pago. El prefijo evita confundirla con una reserva. */
export function courseExternalReference(enrollmentId: string): string {
  return `${PREFIJO}${enrollmentId}`;
}

/** `null` cuando la referencia no es de un curso: el aviso es de otro módulo y no se toca. */
export function parseCourseExternalReference(ref: string): string | null {
  if (!ref.startsWith(PREFIJO)) return null;
  const id = ref.slice(PREFIJO.length).trim();
  return id ? id : null;
}

/** Mercado Pago habla en centavos enteros. El redondeo va una sola vez, acá. */
function aMinor(valor: Prisma.Decimal): number {
  return Number(valor.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toString());
}

export type CourseCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function createCourseEnrollmentCheckout(input: {
  enrollmentId: string;
  workspaceSlug: string;
  courseSlug: string;
}): Promise<CourseCheckoutResult> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: { course: true, courseInstance: true },
  });
  if (!inscripcion) return { ok: false, error: "Inscripción no encontrada." };
  if (inscripcion.paymentStatus !== "PENDING") {
    return { ok: false, error: "La inscripción no está pendiente de pago." };
  }
  if (inscripcion.course.status !== "PUBLISHED") {
    return { ok: false, error: "El curso no está publicado." };
  }
  if (inscripcion.course.slug !== input.courseSlug) {
    return { ok: false, error: "El curso no coincide con la inscripción." };
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: input.workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding || branding.workspaceId !== inscripcion.workspaceId) {
    return { ok: false, error: "La institución no coincide con la inscripción." };
  }

  // El cupo sólo existe cuando hay edición. Un curso grabado no tiene ediciones ni cupo.
  if (inscripcion.courseInstance) {
    if (inscripcion.courseInstance.status !== "ACTIVE") {
      return { ok: false, error: "La edición ya no está activa." };
    }
    const aprobadas = await getApprovedEnrollmentCountsByInstanceIds([
      inscripcion.courseInstance.id,
    ]);
    const libres = computeAvailableSpots(
      inscripcion.courseInstance.capacity,
      aprobadas.get(inscripcion.courseInstance.id) ?? 0,
    );
    if (libres <= 0) return { ok: false, error: "No hay cupos disponibles para esta edición." };
  }

  const collector = await resolveWorkspaceCollector(inscripcion.workspaceId);
  if (!collector.ok) {
    return {
      ok: false,
      error: "La institución todavía no conectó su cuenta de Mercado Pago.",
    };
  }

  const feeBps = await getPlatformFeeBps(inscripcion.workspaceId, COURSES_SALES_MODULE_KEY);
  const { fee, net } = splitByPlatformFee(inscripcion.amountArs, feeBps);

  // La comisión se congela ANTES de abrir el pago: lo que se retiene es exactamente esto.
  // Que la aprobación no la vuelva a calcular es lo que evita que el número cambie después
  // de cobrado.
  await prisma.courseEnrollment.update({
    where: { id: inscripcion.id },
    data: {
      platformFeePercent: new Prisma.Decimal(feeBps).div(100),
      platformFeeArs: fee,
      netAmountArs: net,
    },
  });

  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base) return { ok: false, error: "APP_URL no está configurado." };
  const vuelta = `${base}/w/${input.workspaceSlug}/cursos/${input.courseSlug}/inscripcion`;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: aMinor(inscripcion.amountArs),
      currency: "ARS",
      description: `Inscripción: ${inscripcion.course.title}`,
      externalReference: courseExternalReference(inscripcion.id),
      idempotencyKey: randomUUID(),
      successUrl: `${vuelta}/success?enrollmentId=${inscripcion.id}`,
      pendingUrl: `${vuelta}/pending?enrollmentId=${inscripcion.id}`,
      failureUrl: `${vuelta}/failure?enrollmentId=${inscripcion.id}`,
      notificationUrl: `${base}/api/payments/mp/cursos-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: aMinor(fee),
      itemId: `curso-${inscripcion.courseId}`,
      sourceApp: "FOTOFFICE",
      metadata: { enrollmentId: inscripcion.id, workspaceId: inscripcion.workspaceId },
      payerEmail: inscripcion.email,
    });

    await prisma.courseEnrollment.update({
      where: { id: inscripcion.id },
      data: { paymentRef: preferencia.providerPreferenceId },
    });
    logCourseEvent("checkout_abierto", {
      enrollmentId: inscripcion.id,
      workspaceId: inscripcion.workspaceId,
      feeBps,
    });
    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][cursos] Mercado Pago rechazó la preferencia", {
      enrollmentId: inscripcion.id,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}
