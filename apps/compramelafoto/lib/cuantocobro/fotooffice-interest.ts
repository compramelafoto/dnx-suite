import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLikelyValidEmail, normalizeEmail } from "../email-validation";

export const FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT = "CUANTO_COBRO_RESULT" as const;

export const FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE = "FOTOOFFICE_NEWS_AND_PLATFORM_ADVICE" as const;

export const CC_FOTOOFFICE_RESULT_PROMO_TITLE = "¿Querés mejorar todavía más este precio?";

export const CC_FOTOOFFICE_RESULT_PROMO_TEXT =
  "Con FotoOffice vas a poder medir la actividad real de tu negocio y recibir recomendaciones para optimizar tus precios según consultas recibidas, presupuestos enviados, porcentaje de ventas, ocupación real, estacionalidad, evolución de tu facturación, comportamiento de tus clientes y crecimiento de tu marca.";

export const CC_FOTOOFFICE_RESULT_CTA_PRIMARY = "Quiero ser de los primeros en probar FotoOffice";

export const CC_FOTOOFFICE_INTEREST_CTA_HINT =
  "Te avisaremos sobre las novedades del desarrollo y, si lo deseás, podremos asesorarte para aprovechar al máximo ComprameLaFoto y FotoOffice cuando estén disponibles.";

/** @deprecated Usar CC_FOTOOFFICE_RESULT_PROMO_TEXT */
export const CC_FOTOOFFICE_RESULT_NOTE = CC_FOTOOFFICE_RESULT_PROMO_TEXT;

export const CC_FOTOOFFICE_INTEREST_SUCCESS_MESSAGE =
  "Listo, vamos a avisarte cuando tengamos novedades de FotoOffice y podremos asesorarte sobre el uso de la plataforma.";

export type FotoOfficeInterestMetadataInput = {
  minimumSustainablePrice?: number | null;
  recommendedBusinessPrice?: number | null;
  commercialPositioningId?: string | null;
  commercialPositioningLabel?: string | null;
  jobType?: string | null;
  clientName?: string | null;
  currency?: string | null;
};

export type RegisterFotoOfficeInterestInput = {
  userId?: number | null;
  email?: string | null;
  name?: string | null;
  source?: string;
  interestType?: string;
  metadata?: FotoOfficeInterestMetadataInput | null;
};

export type RegisterFotoOfficeInterestResult = {
  ok: true;
  created: boolean;
  id: string;
};

const MAX_STRING_LENGTH = 200;

export function sanitizeInterestString(value: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

export function buildFotoOfficeInterestMetadata(
  input: FotoOfficeInterestMetadataInput | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!input || typeof input !== "object") return undefined;

  const metadata: Record<string, string | number> = {};

  if (typeof input.minimumSustainablePrice === "number" && Number.isFinite(input.minimumSustainablePrice)) {
    metadata.minimumSustainablePrice = Math.round(input.minimumSustainablePrice);
  }
  if (typeof input.recommendedBusinessPrice === "number" && Number.isFinite(input.recommendedBusinessPrice)) {
    metadata.recommendedBusinessPrice = Math.round(input.recommendedBusinessPrice);
  }

  const positioningId = sanitizeInterestString(input.commercialPositioningId, 40);
  if (positioningId) metadata.commercialPositioningId = positioningId;

  const positioningLabel = sanitizeInterestString(input.commercialPositioningLabel, 120);
  if (positioningLabel) metadata.commercialPositioningLabel = positioningLabel;

  const jobType = sanitizeInterestString(input.jobType, 120);
  if (jobType) metadata.jobType = jobType;

  const clientName = sanitizeInterestString(input.clientName, 120);
  if (clientName) metadata.clientName = clientName;

  const currency = sanitizeInterestString(input.currency, 8);
  if (currency) metadata.currency = currency;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function buildFotoOfficeInterestWhere(
  input: Pick<RegisterFotoOfficeInterestInput, "userId" | "email" | "source" | "interestType">,
): Prisma.FotoOfficeInterestWhereInput | null {
  const source = sanitizeInterestString(input.source, 80);
  const interestType = sanitizeInterestString(input.interestType, 80);
  if (!source || !interestType) return null;

  if (typeof input.userId === "number" && input.userId > 0) {
    return { userId: input.userId, source, interestType };
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  if (email && isLikelyValidEmail(email)) {
    return { userId: null, email, source, interestType };
  }

  return null;
}

export async function registerFotoOfficeInterest(
  input: RegisterFotoOfficeInterestInput,
): Promise<RegisterFotoOfficeInterestResult> {
  const source = sanitizeInterestString(input.source, 80) ?? FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT;
  const interestType =
    sanitizeInterestString(input.interestType, 80) ?? FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE;

  const userId = typeof input.userId === "number" && input.userId > 0 ? input.userId : null;
  const emailFromInput = input.email ? normalizeEmail(input.email) : null;
  const email =
    emailFromInput && isLikelyValidEmail(emailFromInput) ? emailFromInput : null;
  const name = sanitizeInterestString(input.name, 120);
  const metadata = buildFotoOfficeInterestMetadata(input.metadata ?? null);

  if (!userId && !email) {
    throw new Error("EMAIL_REQUIRED");
  }

  const where = buildFotoOfficeInterestWhere({ userId, email, source, interestType });
  if (!where) {
    throw new Error("INVALID_INTEREST");
  }

  const existing = await prisma.fotoOfficeInterest.findFirst({
    where,
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    const updated = await prisma.fotoOfficeInterest.update({
      where: { id: existing.id },
      data: {
        ...(name ? { name } : {}),
        ...(email && !existing.email ? { email } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
        updatedAt: new Date(),
      },
    });

    return { ok: true, created: false, id: updated.id };
  }

  const created = await prisma.fotoOfficeInterest.create({
    data: {
      userId,
      email,
      name,
      source,
      interestType,
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });

  return { ok: true, created: true, id: created.id };
}
