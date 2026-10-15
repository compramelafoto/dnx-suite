import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { getActiveFeeValue } from "@/lib/membership/settings";
import { RENEWAL_PERIOD_PREFIX, isAbandonedRenewal, renewalPeriodFor } from "./enrollment";

/**
 * Alta sin aprobación y renovación sin deuda — la parte que toca la base (ver `enrollment.ts`).
 */

export type EnrollmentSettings = {
  autoApprove: boolean;
  simpleForm: boolean;
  /** La categoría que recibe quien se asocia desde el sitio, si es de esta institución y está activa. */
  category: { id: string; name: string; description: string | null } | null;
};

export async function getEnrollmentSettings(workspaceId: string): Promise<EnrollmentSettings> {
  const fila = await prisma.membershipDuesSettings.findUnique({
    where: { workspaceId },
    select: { autoApproveApplications: true, simpleApplicationForm: true, applicationCategoryId: true },
  });
  const category = fila?.applicationCategoryId
    ? await prisma.memberCategory.findFirst({
        where: { id: fila.applicationCategoryId, workspaceId, isActive: true },
        select: { id: true, name: true, description: true },
      })
    : null;
  return {
    autoApprove: fila?.autoApproveApplications ?? false,
    simpleForm: fila?.simpleApplicationForm ?? false,
    category,
  };
}

export type RenewalOffer =
  | { available: true; amountMinor: number; categoryName: string }
  | { available: false };

/** Si la persona puede renovar desde su portal, y a qué precio. */
export async function loadRenewalOffer(input: { workspaceId: string; memberId: string; now?: Date }): Promise<RenewalOffer> {
  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId, status: "ACTIVE" },
    select: { categoryId: true, category: { select: { name: true, selfRenew: true } } },
  });
  if (!socio?.category?.selfRenew || !socio.categoryId) return { available: false };
  const valor = await getActiveFeeValue(input.workspaceId, socio.categoryId, input.now ?? new Date());
  if (!valor) return { available: false };
  const amountMinor = decimalArsToMinor(valor.amountArs);
  if (amountMinor <= 0) return { available: false };
  return { available: true, amountMinor, categoryName: socio.category.name };
}

export type RenewalCharge = { ok: true; chargeId: string; amountMinor: number } | { ok: false; error: string };

/**
 * Crea el cargo de una renovación, recién cuando la persona decide pagar.
 *
 * Antes borra las renovaciones suyas que quedaron intactas: si apretó "Renovar", no pagó y
 * vuelve a apretar, no le quedan dos cargos. Se borran sólo los que no tienen ningún pago
 * imputado; uno pagado nunca se toca.
 */
export async function createRenewalCharge(input: {
  workspaceId: string;
  memberId: string;
  now?: Date;
}): Promise<RenewalCharge> {
  const now = input.now ?? new Date();
  const oferta = await loadRenewalOffer({ ...input, now });
  if (!oferta.available) {
    return { ok: false, error: "Tu categoría no se renueva desde el portal." };
  }

  return prisma.$transaction(async (tx) => {
    const previas = await tx.membershipCharge.findMany({
      where: {
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        concept: "OTRO",
        period: { startsWith: RENEWAL_PERIOD_PREFIX },
        allocations: { none: {} },
      },
      select: { id: true, amountArs: true, balanceArs: true },
    });
    const intactas = previas
      .filter((c) => decimalArsToMinor(c.amountArs) === decimalArsToMinor(c.balanceArs))
      .map((c) => c.id);
    if (intactas.length > 0) {
      await tx.membershipCharge.deleteMany({ where: { id: { in: intactas } } });
    }

    const cargo = await tx.membershipCharge.create({
      data: {
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        concept: "OTRO",
        period: renewalPeriodFor(now),
        amountArs: minorToDecimalString(oferta.amountMinor),
        balanceArs: minorToDecimalString(oferta.amountMinor),
        dueDate: now,
      },
      select: { id: true },
    });
    return { ok: true as const, chargeId: cargo.id, amountMinor: oferta.amountMinor };
  });
}

/**
 * Borra las renovaciones abandonadas (sin pagar, pasado el plazo) para que no queden como
 * deuda. La corre el cron de conciliación. Un pago que llega tarde no se pierde: queda como
 * saldo a favor y se imputa a la próxima.
 */
export async function cleanupAbandonedRenewals(input: { now?: Date; graceHours?: number } = {}): Promise<number> {
  const now = input.now ?? new Date();
  const graceHours = input.graceHours ?? 72;
  const candidatas = await prisma.membershipCharge.findMany({
    where: {
      concept: "OTRO",
      period: { startsWith: RENEWAL_PERIOD_PREFIX },
      allocations: { none: {} },
      createdAt: { lte: new Date(now.getTime() - graceHours * 60 * 60 * 1000) },
    },
    select: { id: true, period: true, amountArs: true, balanceArs: true, createdAt: true },
    take: 500,
  });
  const borrar = candidatas
    .filter((c) =>
      isAbandonedRenewal({
        period: c.period,
        amountMinor: decimalArsToMinor(c.amountArs),
        balanceMinor: decimalArsToMinor(c.balanceArs),
        createdAt: c.createdAt,
        hasAllocations: false,
        now,
        graceHours,
      }),
    )
    .map((c) => c.id);
  if (borrar.length === 0) return 0;
  const r = await prisma.membershipCharge.deleteMany({ where: { id: { in: borrar }, allocations: { none: {} } } });
  return r.count;
}
