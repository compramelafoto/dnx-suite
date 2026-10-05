import "server-only";
import { prisma } from "@repo/db";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { ensureCashCategory, recordCollectionFees, reverseCollection } from "@/lib/cash/collection";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { logCourseEvent } from "./log";

/**
 * Los cursos (presenciales y grabados) en Caja.
 *
 * Hasta el 2026-10-05 una inscripción pagada por Mercado Pago no llegaba nunca a Caja: la
 * plata entraba a la cuenta de la institución y el libro no se enteraba. Cuotas, reservas y
 * tienda sí depositaban.
 *
 * Nunca lanza: el pago ya está aprobado y el acceso dado. Si Caja falla, queda registrado y
 * la conciliación diaria vuelve a intentarlo (el depósito es idempotente por inscripción).
 */

export const COURSES_CASH_CATEGORY = "Cursos";

export async function depositCoursePayment(input: {
  enrollmentId: string;
  /** Fecha de aprobación según Mercado Pago. */
  paidAt: Date;
  mpFeeMinor: number;
  platformFeeMinor: number;
}): Promise<{ deposited: boolean }> {
  try {
    const inscripcion = await prisma.courseEnrollment.findUnique({
      where: { id: input.enrollmentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        amountArs: true,
        paymentStatus: true,
        course: { select: { title: true } },
      },
    });
    if (!inscripcion || inscripcion.paymentStatus !== "APPROVED") return { deposited: false };
    const montoMinor = decimalArsToMinor(inscripcion.amountArs);
    if (montoMinor <= 0) return { deposited: false };
    if (!(await isModuleEnabledForWorkspace(inscripcion.workspaceId, CASH_MODULE_KEY))) {
      return { deposited: false };
    }

    return await prisma.$transaction(async (tx) => {
      await ensureCashCategory(tx, inscripcion.workspaceId, COURSES_CASH_CATEGORY, "INGRESO");
      const destino = resolveDepositTarget({
        cashEnabled: true,
        paymentMethod: "MERCADO_PAGO",
        accounts: await tx.cashAccount.findMany({
          where: { workspaceId: inscripcion.workspaceId, isActive: true },
          select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
          orderBy: { order: "asc" },
        }),
        categories: await tx.cashCategory.findMany({
          where: { workspaceId: inscripcion.workspaceId, kind: "INGRESO", isActive: true },
          select: { id: true, name: true, kind: true },
        }),
        categoryName: COURSES_CASH_CATEGORY,
      });
      if (!destino.ok) return { deposited: false };

      const r = await recordCashMovement(tx, {
        workspaceId: inscripcion.workspaceId,
        accountId: destino.accountId,
        categoryId: destino.categoryId,
        kind: "INGRESO",
        amountMinor: montoMinor,
        occurredAt: input.paidAt,
        description: `Curso — ${inscripcion.course.title} — ${inscripcion.name}`,
        paymentMethod: "MERCADO_PAGO",
        sourceModule: "courses",
        sourceRef: inscripcion.id,
      });
      await recordCollectionFees(tx, {
        workspaceId: inscripcion.workspaceId,
        sourceModule: "courses",
        sourceRef: inscripcion.id,
        mpFeeMinor: input.mpFeeMinor,
        platformFeeMinor: input.platformFeeMinor,
      });
      return { deposited: r.created };
    });
  } catch (error) {
    console.error("[fotoffice_courses] cash_deposit_failed", {
      enrollmentId: input.enrollmentId,
      error: error instanceof Error ? error.message : "error",
    });
    return { deposited: false };
  }
}

/**
 * El pago de una inscripción se devolvió o se desconoció: la inscripción deja de contar (libera
 * el cupo), se quita el acceso al aula si era un curso grabado, y se anula en Caja.
 */
export async function refundCourseEnrollment(input: {
  enrollmentId: string;
  reason: string;
  at: Date;
}): Promise<{ applied: boolean }> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, workspaceId: true, paymentStatus: true },
  });
  if (!inscripcion) return { applied: false };

  let applied = false;
  await prisma.$transaction(async (tx) => {
    if (inscripcion.paymentStatus === "APPROVED") {
      await tx.courseEnrollment.update({
        where: { id: inscripcion.id },
        data: { paymentStatus: "CANCELLED" },
      });
      await tx.courseAccess.updateMany({
        where: { enrollmentId: inscripcion.id, revokedAt: null },
        data: { revokedAt: input.at },
      });
      applied = true;
    }
    const r = await reverseCollection(tx, {
      workspaceId: inscripcion.workspaceId,
      sourceModule: "courses",
      sourceRef: inscripcion.id,
      reason: input.reason,
      occurredAt: input.at,
    });
    if (r.reversed > 0) applied = true;
  });
  if (applied) {
    logCourseEvent("payment_refunded", { enrollmentId: inscripcion.id, workspaceId: inscripcion.workspaceId });
  }
  return { applied };
}
