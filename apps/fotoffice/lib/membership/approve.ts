import { Prisma } from "@repo/db";
import { initialChargeTotal, monthlyAmountFor, type FeeScale } from "./amounts";
import { nextMemberNumber } from "./member-number";
import { initialDuePeriods } from "./periods";

/** Días que tiene la persona para pagar antes de que la solicitud venza. */
export const APPLICATION_PAYMENT_DAYS = 30;

export class ApprovalError extends Error {
  constructor(
    readonly code: "ESTADO_INVALIDO" | "SIN_VALOR_DE_CUOTA",
    message: string,
  ) {
    super(message);
    this.name = "ApprovalError";
  }
}

export type ApprovalInput = {
  application: {
    id: string;
    workspaceId: string;
    firstName: string;
    lastName: string;
    email: string;
    declaredFeeScale: FeeScale;
    ownDuesAmount: Prisma.Decimal | null;
    originInstitution: string | null;
    avatarUrl: string | null;
    noticeAddress: string | null;
    documentType: string | null;
    documentNumber: string | null;
    phone: string | null;
    taxId: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    categoryId: string | null;
    status: string;
  };
  settings: {
    dueDay: number;
    initialDuesCount: number;
    countJoinMonthIfBeforeDueDay: boolean;
    collaboratorFloorMultiple: number;
  };
  referenceAmount: Prisma.Decimal;
  feeValueId: string | null;
  /** Números de socio ya usados en la institución. */
  existingNumbers: readonly string[];
  now: Date;
};

export type ApprovalPlan = {
  member: {
    workspaceId: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    documentType: string | null;
    documentNumber: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    avatarUrl: string | null;
    categoryId: string | null;
    feeScale: FeeScale;
    ownDuesAmount: Prisma.Decimal | null;
    originInstitution: string | null;
    joinedAt: Date;
  };
  charges: Array<{
    workspaceId: string;
    concept: "INGRESO";
    period: string;
    amountArs: Prisma.Decimal;
    balanceArs: Prisma.Decimal;
    dueDate: Date;
    feeValueId: string | null;
  }>;
  totalArs: Prisma.Decimal;
  applicationUpdate: {
    status: "APROBADA_IMPAGA";
    expiresAt: Date;
  };
};

/**
 * Arma todo lo que la aprobación va a escribir, **sin tocar la base**.
 *
 * Se separa del acceso a datos a propósito: acá vive la lógica que decide número, montos y
 * períodos, que es la que puede estar mal de formas caras. Quien la use debe escribir el
 * resultado en **una sola transacción**: crear el socio, generar los cargos y actualizar la
 * solicitud son un solo hecho. Si se hiciera en pasos sueltos, una falla intermedia dejaría
 * un socio sin cuotas o cuotas sin socio.
 *
 * El número calculado no garantiza unicidad por sí solo: la restricción
 * `[workspaceId, memberNumber]` es el árbitro real ante dos aprobaciones simultáneas.
 */
export function buildApproval(input: ApprovalInput): ApprovalPlan {
  if (input.application.status !== "PENDIENTE") {
    // Aprobar dos veces la misma solicitud crearía dos socios para la misma persona.
    throw new ApprovalError(
      "ESTADO_INVALIDO",
      "Esta solicitud ya fue resuelta. Actualizá la lista.",
    );
  }
  if (!input.referenceAmount) {
    throw new ApprovalError(
      "SIN_VALOR_DE_CUOTA",
      "La institución todavía no configuró el valor de la cuota.",
    );
  }

  const monthly = monthlyAmountFor({
    referenceAmount: input.referenceAmount,
    scale: input.application.declaredFeeScale,
    ownAmount: input.application.ownDuesAmount,
    floorMultiple: input.settings.collaboratorFloorMultiple,
  });

  const periods = initialDuePeriods({
    joinedAt: input.now,
    count: input.settings.initialDuesCount,
    dueDay: input.settings.dueDay,
    countJoinMonthIfBeforeDueDay: input.settings.countJoinMonthIfBeforeDueDay,
  });

  const charges = periods.map((p) => ({
    workspaceId: input.application.workspaceId,
    concept: "INGRESO" as const,
    period: p.period,
    amountArs: monthly,
    // Nace impago: el saldo es el monto entero hasta que se acredite el pago.
    balanceArs: monthly,
    dueDate: p.dueDate,
    feeValueId: input.feeValueId,
  }));

  return {
    member: {
      workspaceId: input.application.workspaceId,
      memberNumber: nextMemberNumber(input.existingNumbers),
      firstName: input.application.firstName,
      lastName: input.application.lastName,
      email: input.application.email,
      phone: input.application.phone,
      documentType: input.application.documentType,
      documentNumber: input.application.documentNumber,
      address: input.application.noticeAddress,
      city: input.application.city,
      province: input.application.province,
      postalCode: input.application.postalCode,
      // La foto que mandó al inscribirse pasa a ser su perfil: si la Secretaría aprueba,
      // aprueba también la foto.
      avatarUrl: input.application.avatarUrl,
      categoryId: input.application.categoryId,
      feeScale: input.application.declaredFeeScale,
      ownDuesAmount: input.application.ownDuesAmount,
      originInstitution: input.application.originInstitution,
      joinedAt: input.now,
    },
    charges,
    totalArs: initialChargeTotal(monthly, periods.length),
    applicationUpdate: {
      status: "APROBADA_IMPAGA",
      expiresAt: new Date(
        input.now.getTime() + APPLICATION_PAYMENT_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
  };
}
