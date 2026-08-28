import { prisma } from "@repo/db";
import { buildApproval, ApprovalError, type ApprovalPlan } from "./approve";
import { pickCategoryForScale } from "./category-for-scale";
import { getActiveFeeValue, getDuesSettings } from "./settings";
import type { FeeScale } from "./amounts";

export type ApproveResult = {
  memberId: string;
  memberNumber: string;
  totalArs: string;
  chargeCount: number;
};

/**
 * Aprueba una solicitud: crea el socio, le asigna número, genera los cargos de ingreso y
 * marca la solicitud como aprobada e impaga.
 *
 * **Todo ocurre en una sola transacción.** Crear el socio, generar sus cuotas y actualizar
 * la solicitud son un único hecho: si se hiciera en pasos sueltos, una falla intermedia
 * dejaría un socio sin cuotas —que parecería estar al día sin haber pagado— o cuotas sin
 * socio.
 *
 * Ante dos aprobaciones simultáneas, la restricción `[workspaceId, memberNumber]` hace de
 * árbitro: una transacción falla y se reintenta con el número siguiente.
 */
export async function approveApplication(input: {
  applicationId: string;
  workspaceId: string;
  resolvedByUserId: number;
  now?: Date;
  /** Reintentos ante colisión de número. Con más de un par de secretarios simultáneos igual alcanza. */
  maxRetries?: number;
}): Promise<ApproveResult> {
  const now = input.now ?? new Date();
  const maxRetries = input.maxRetries ?? 3;

  const application = await prisma.membershipApplication.findFirst({
    where: { id: input.applicationId, workspaceId: input.workspaceId },
  });
  if (!application) {
    throw new ApprovalError("ESTADO_INVALIDO", "No se encontró la solicitud.");
  }

  const settings = await getDuesSettings(input.workspaceId);

  // El formulario público pregunta la condición, no la categoría del padrón. Se resuelve acá
  // por convención de nombre; si la institución no tiene una que coincida, queda sin asignar y
  // la Secretaría la elige, que es preferible a ponerle una que signifique otra cosa.
  const categorias = await prisma.memberCategory.findMany({
    where: { workspaceId: input.workspaceId },
    select: { id: true, name: true },
  });
  const categoryId =
    application.categoryId ??
    pickCategoryForScale(application.declaredFeeScale as FeeScale, categorias);
  const feeValue = await getActiveFeeValue(input.workspaceId, categoryId, now);
  if (!feeValue) {
    throw new ApprovalError(
      "SIN_VALOR_DE_CUOTA",
      "La institución todavía no configuró el valor de la cuota.",
    );
  }

  let ultimoError: unknown = null;

  for (let intento = 0; intento < maxRetries; intento++) {
    // Los números se releen en cada intento: si otro secretario tomó el 734, este ve el 735.
    const existentes = await prisma.member.findMany({
      where: { workspaceId: input.workspaceId },
      select: { memberNumber: true },
    });

    const plan: ApprovalPlan = buildApproval({
      application: {
        ...application,
        categoryId,
        declaredFeeScale: application.declaredFeeScale as FeeScale,
      },
      settings,
      referenceAmount: feeValue.amountArs,
      feeValueId: feeValue.id,
      existingNumbers: existentes.map((m) => m.memberNumber),
      now,
    });

    try {
      return await prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: { ...plan.member },
          select: { id: true, memberNumber: true },
        });

        if (plan.charges.length > 0) {
          await tx.membershipCharge.createMany({
            data: plan.charges.map((c) => ({ ...c, memberId: member.id })),
          });
        }

        // El `status: "PENDIENTE"` en el where es la segunda defensa contra la doble
        // aprobación: si otra transacción ya la resolvió, esta no encuentra nada y falla.
        const actualizadas = await tx.membershipApplication.updateMany({
          where: { id: input.applicationId, status: "PENDIENTE" },
          data: {
            status: plan.applicationUpdate.status,
            expiresAt: plan.applicationUpdate.expiresAt,
            memberId: member.id,
            resolvedByUserId: input.resolvedByUserId,
            resolvedAt: now,
          },
        });
        if (actualizadas.count === 0) {
          throw new ApprovalError(
            "ESTADO_INVALIDO",
            "Esta solicitud ya fue resuelta por otra persona.",
          );
        }

        return {
          memberId: member.id,
          memberNumber: member.memberNumber,
          totalArs: plan.totalArs.toFixed(2),
          chargeCount: plan.charges.length,
        };
      });
    } catch (error) {
      // Un estado inválido no se reintenta: la solicitud ya está resuelta.
      if (error instanceof ApprovalError) throw error;
      ultimoError = error;
      const codigo = (error as { code?: string })?.code;
      // P2002 = choque de restricción única: otro secretario tomó ese número. Se reintenta.
      if (codigo !== "P2002") throw error;
    }
  }

  throw ultimoError ?? new Error("No se pudo asignar un número de socio.");
}

/** Rechaza una solicitud. El motivo es obligatorio: se le comunica a la persona. */
export async function rejectApplication(input: {
  applicationId: string;
  workspaceId: string;
  resolvedByUserId: number;
  reason: string;
  now?: Date;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ApprovalError("ESTADO_INVALIDO", "El rechazo necesita un motivo.");
  }

  const actualizadas = await prisma.membershipApplication.updateMany({
    where: { id: input.applicationId, workspaceId: input.workspaceId, status: "PENDIENTE" },
    data: {
      status: "RECHAZADA",
      rejectionReason: reason,
      resolvedByUserId: input.resolvedByUserId,
      resolvedAt: input.now ?? new Date(),
    },
  });

  if (actualizadas.count === 0) {
    throw new ApprovalError("ESTADO_INVALIDO", "Esta solicitud ya fue resuelta.");
  }
}
