import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { generateRecommendationCode } from "./recommendation-code";
import {
  benefitDiscountMinor,
  canVoidBenefit,
  pickChargeForBenefit,
  shouldAwardBenefit,
  type BenefitCharge,
} from "./recommendation";
import { getDuesSettings } from "./settings";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import { buildRecommendationEarnedEmail } from "./recommendation-emails";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { MEMBERSHIP_EMAIL_KEYS } from "@/lib/communications/constants";
import { appUrl } from "@/lib/app-url";

/**
 * Acceso a base de las recomendaciones.
 *
 * Capa fina a propósito: toda la regla vive en `recommendation.ts`, que es puro y está
 * probado. Acá sólo se lee, se escribe y se ordenan las transacciones.
 */

/**
 * El código del enlace de este socio, creándolo si todavía no tiene.
 *
 * Se genera cuando el socio entra por primera vez a su pantalla de recomendaciones y no al
 * crear la ficha: generarlo para los 152 socios de una sola vez llenaría el padrón de
 * códigos que nadie va a usar.
 */
export async function ensureRecommendationCode(memberId: string): Promise<string> {
  const actual = await prisma.member.findUnique({
    where: { id: memberId },
    select: { recommendationCode: true },
  });
  if (actual?.recommendationCode) return actual.recommendationCode;

  // Reintentos por si el código sorteado ya existe. Con 31^10 combinaciones la colisión es
  // improbable, pero la restricción única es el único árbitro real y hay que responderle.
  for (let intento = 0; intento < 5; intento++) {
    const code = generateRecommendationCode((n) => new Uint8Array(randomBytes(n)));
    try {
      await prisma.member.update({ where: { id: memberId }, data: { recommendationCode: code } });
      return code;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("No se pudo generar un código de recomendación único.");
}

/**
 * Acredita la bonificación al socio que recomendó a este socio nuevo.
 *
 * Se la llama cuando el alta termina de pagarse, no cuando se aprueba: hay altas aprobadas
 * que nunca se pagan, y bonificar por ellas sería regalar cuotas por socios que no existen.
 *
 * **Idempotente:** la restricción única sobre `originMemberId` garantiza una sola
 * bonificación por alta, aunque el webhook de Mercado Pago entre dos veces.
 */
export async function awardRecommendationBenefit(
  newMemberId: string,
): Promise<{ awarded: boolean; reason?: string }> {
  const socioNuevo = await prisma.member.findUnique({
    where: { id: newMemberId },
    select: {
      id: true,
      workspaceId: true,
      recommendedByMemberId: true,
      recommendedBy: { select: { id: true, status: true } },
    },
  });
  if (!socioNuevo) return { awarded: false, reason: "No existe el socio." };

  const settings = await getDuesSettings(socioNuevo.workspaceId);
  const yaOtorgada = await prisma.membershipRecommendationBenefit.findUnique({
    where: { originMemberId: newMemberId },
    select: { id: true },
  });

  const decision = shouldAwardBenefit({
    enabled: settings.recommendationEnabled,
    percent: settings.recommendationBenefitPercent,
    recommenderMemberId: socioNuevo.recommendedByMemberId,
    recommenderStatus: socioNuevo.recommendedBy?.status ?? null,
    newMemberId,
    alreadyAwarded: Boolean(yaOtorgada),
  });
  if (!decision.award) return { awarded: false, reason: decision.reason };

  const recomendanteId = socioNuevo.recommendedByMemberId!;

  try {
    await prisma.membershipRecommendationBenefit.create({
      data: {
        workspaceId: socioNuevo.workspaceId,
        memberId: recomendanteId,
        originMemberId: newMemberId,
        // Congelado: cambiar la configuración mañana no reescribe lo que ya se ganó.
        percent: decision.percent.toFixed(2),
      },
      select: { id: true },
    });
  } catch (error) {
    // P2002: otra ejecución la creó primero. Es el caso normal ante un webhook repetido.
    if ((error as { code?: string })?.code === "P2002") {
      return { awarded: false, reason: "Ya estaba acreditada." };
    }
    throw error;
  }

  await applyPendingBenefits(recomendanteId);

  // El aviso va después de aplicar el descuento: si el socio abre el portal apenas lo recibe,
  // la cuota ya tiene que estar barata. Su propio try/catch — un email que no sale no puede
  // deshacer una bonificación ya acreditada.
  try {
    await notificarBonificacion({
      workspaceId: socioNuevo.workspaceId,
      recomendanteId,
      newMemberId,
      percent: decision.percent,
    });
  } catch (error) {
    console.error("[fotoffice][recomendaciones] no se pudo avisar la bonificación", {
      memberId: recomendanteId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }

  return { awarded: true };
}

/** Le avisa al recomendante que su colega se asoció y que su cuota viene con descuento. */
async function notificarBonificacion(input: {
  workspaceId: string;
  recomendanteId: string;
  newMemberId: string;
  percent: number;
}): Promise<void> {
  const [recomendante, recomendado] = await Promise.all([
    prisma.member.findUnique({
      where: { id: input.recomendanteId },
      select: { firstName: true, email: true, userId: true },
    }),
    prisma.member.findUnique({
      where: { id: input.newMemberId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  // Sin casilla no hay a quién escribirle, y no se inventa un destinatario. El socio ve la
  // bonificación igual en su portal.
  if (!recomendante?.email || !recomendado) return;

  const { organizationName, signature } = await loadWorkspaceEmailContext(input.workspaceId);
  const base = appUrl();

  await sendAndLogEmail({
    to: recomendante.email,
    templateKey: MEMBERSHIP_EMAIL_KEYS.RECOMMENDATION_EARNED,
    userId: recomendante.userId,
    body: buildRecommendationEarnedEmail({
      firstName: recomendante.firstName,
      recommendedName: `${recomendado.firstName} ${recomendado.lastName}`.trim(),
      institution: organizationName,
      percent: input.percent,
      duesUrl: `${base}/portal/cuotas`,
      signature,
    }),
  });
}

/**
 * Aplica las bonificaciones pendientes de un socio sobre sus cuotas.
 *
 * Se la llama al ganar una bonificación y al generar las cuotas del mes. Si el socio está al
 * día, no hace nada y la bonificación espera: se va a aplicar sola sobre la cuota siguiente.
 *
 * Cada bonificación baja el saldo de UNA cuota. El descuento se calcula sobre el valor
 * original y se acota al saldo, así que nunca deja el saldo en negativo.
 */
export async function applyPendingBenefits(memberId: string): Promise<{ applied: number }> {
  const pendientes = await prisma.membershipRecommendationBenefit.findMany({
    where: { memberId, status: "PENDIENTE" },
    select: { id: true, percent: true },
    orderBy: { createdAt: "asc" },
  });
  if (pendientes.length === 0) return { applied: 0 };

  let aplicadas = 0;

  for (const bonificacion of pendientes) {
    const aplicado = await prisma.$transaction(async (tx) => {
      // Los cargos y las bonificaciones ya usadas se releen dentro de la transacción: entre
      // una vuelta y la siguiente pudo acreditarse un pago o generarse la cuota del mes.
      const filas = await tx.membershipCharge.findMany({
        where: { memberId, balanceArs: { gt: 0 } },
        select: {
          id: true,
          concept: true,
          period: true,
          dueDate: true,
          amountArs: true,
          balanceArs: true,
        },
      });
      const cargos: BenefitCharge[] = filas.map((f) => ({
        id: f.id,
        concept: String(f.concept),
        period: f.period,
        dueDate: f.dueDate,
        amountMinor: decimalArsToMinor(f.amountArs),
        balanceMinor: decimalArsToMinor(f.balanceArs),
      }));

      const yaBonificados = await tx.membershipRecommendationBenefit.findMany({
        where: { memberId, status: "APLICADA", appliedChargeId: { not: null } },
        select: { appliedChargeId: true },
      });

      const cargo = pickChargeForBenefit(
        cargos,
        yaBonificados.map((b) => b.appliedChargeId!),
      );
      if (!cargo) return false;

      const descuento = benefitDiscountMinor({
        amountMinor: cargo.amountMinor,
        balanceMinor: cargo.balanceMinor,
        percent: Number(bonificacion.percent),
      });
      if (descuento <= 0) return false;

      await tx.membershipCharge.update({
        where: { id: cargo.id },
        data: { balanceArs: minorToDecimalString(cargo.balanceMinor - descuento) },
      });

      // El `status` en el where hace idempotente la aplicación: si dos ejecuciones coinciden,
      // la segunda no encuentra nada que actualizar y la transacción entera se deshace, así
      // que el descuento no se aplica dos veces sobre la misma cuota.
      const marcadas = await tx.membershipRecommendationBenefit.updateMany({
        where: { id: bonificacion.id, status: "PENDIENTE" },
        data: {
          status: "APLICADA",
          appliedChargeId: cargo.id,
          appliedAmountArs: minorToDecimalString(descuento),
          appliedAt: new Date(),
        },
      });
      if (marcadas.count === 0) throw new Error("La bonificación ya había sido aplicada.");

      return true;
    });

    if (aplicado) aplicadas += 1;
    // Sin cuota elegible, las que siguen tampoco la van a encontrar: esperan al mes que viene.
    else break;
  }

  return { applied: aplicadas };
}

/**
 * Anula una bonificación.
 *
 * Si estaba aplicada a una cuota impaga, el importe vuelve al saldo. Si la cuota ya se pagó,
 * se rechaza: revertirla convertiría a un socio al día en deudor de algo que ya abonó.
 */
export async function voidRecommendationBenefit(input: {
  benefitId: string;
  workspaceId: string;
  userId: number;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const motivo = input.reason.trim();
  if (!motivo) return { ok: false, error: "El motivo de la anulación es obligatorio." };

  return prisma.$transaction(async (tx) => {
    const bonificacion = await tx.membershipRecommendationBenefit.findFirst({
      where: { id: input.benefitId, workspaceId: input.workspaceId },
      select: {
        id: true,
        status: true,
        appliedAmountArs: true,
        appliedCharge: { select: { id: true, balanceArs: true } },
      },
    });
    if (!bonificacion) return { ok: false as const, error: "No se encontró la bonificación." };

    const saldo = bonificacion.appliedCharge
      ? decimalArsToMinor(bonificacion.appliedCharge.balanceArs)
      : null;
    const permitido = canVoidBenefit({
      status: bonificacion.status as "PENDIENTE" | "APLICADA" | "ANULADA",
      appliedChargeBalanceMinor: saldo,
    });
    if (!permitido.ok) return { ok: false as const, error: permitido.reason };

    if (bonificacion.appliedCharge && bonificacion.appliedAmountArs) {
      const devuelto = (saldo ?? 0) + decimalArsToMinor(bonificacion.appliedAmountArs);
      await tx.membershipCharge.update({
        where: { id: bonificacion.appliedCharge.id },
        data: { balanceArs: minorToDecimalString(devuelto) },
      });
    }

    const anuladas = await tx.membershipRecommendationBenefit.updateMany({
      where: { id: bonificacion.id, status: { not: "ANULADA" } },
      data: {
        status: "ANULADA",
        voidedAt: new Date(),
        voidedByUserId: input.userId,
        voidReason: motivo,
      },
    });
    if (anuladas.count === 0) {
      return { ok: false as const, error: "Esta bonificación ya estaba anulada." };
    }

    return { ok: true as const };
  });
}

export type AppliedBenefit = {
  id: string;
  chargeId: string;
  /** `YYYY-MM` de la cuota bonificada. */
  period: string;
  discountMinor: number;
  /** Nombre del colega que la originó. */
  originName: string;
};

/**
 * Las bonificaciones ya aplicadas de un socio, para mostrarlas junto a sus cuotas.
 *
 * Tienen sección propia y no una línea dentro de la lista de deuda por una razón concreta:
 * una cuota bonificada al 100% queda en cero, y la lista de deuda sólo muestra lo que tiene
 * saldo. Sin esto, el beneficio más grande sería justamente el único invisible.
 */
export async function loadAppliedBenefits(memberId: string): Promise<AppliedBenefit[]> {
  const filas = await prisma.membershipRecommendationBenefit.findMany({
    where: { memberId, status: "APLICADA", appliedChargeId: { not: null } },
    select: {
      id: true,
      appliedChargeId: true,
      appliedAmountArs: true,
      appliedCharge: { select: { period: true } },
      originMember: { select: { firstName: true, lastName: true } },
    },
    orderBy: { appliedAt: "desc" },
  });

  return filas.map((f) => ({
    id: f.id,
    chargeId: f.appliedChargeId!,
    period: f.appliedCharge?.period ?? "",
    discountMinor: f.appliedAmountArs ? decimalArsToMinor(f.appliedAmountArs) : 0,
    originName: `${f.originMember.firstName} ${f.originMember.lastName}`.trim(),
  }));
}
