import "server-only";
import { prisma } from "@repo/db";
import { computeDelinquency, type DuesCharge } from "./delinquency";
import { computeCardStatus, explainDisabled, type MemberInstitutionalStatus } from "./status";
import { openCardToken } from "./token-vault";
import { decimalArsToMinor } from "@/lib/membership/money";
import type { FulfillmentState } from "./fulfillment";

/**
 * El carnet del propio socio — **nivel 2**.
 *
 * A diferencia del nivel público, acá sí se dice por qué no está habilitado y cuánto debe:
 * es su propia situación, y ocultársela le impediría resolverla.
 */
export type MyCardView = {
  cardNumber: string;
  memberNumber: string;
  fullName: string;
  institutionName: string;
  category: string | null;
  photoUrl: string | null;
  validUntil: Date;
  enabled: boolean;
  /** Explicación para el socio. `null` si está habilitado. */
  disabledReason: string | null;
  /** URL que codifica el QR. `null` si el token no se pudo descifrar. */
  verificationUrl: string | null;
  totalDueMinor: number;
  /** Estado de la tarjeta impresa, si la pidió. */
  printedState: FulfillmentState | null;
  /** Hasta cuándo vale esa tarjeta impresa. Decide si corresponde reemitirla. */
  printedValidUntil: Date | null;
};

export async function loadMyCard(
  memberId: string,
  baseUrl: string,
): Promise<MyCardView | null> {
  const card = await prisma.memberCard.findFirst({
    where: { memberId, format: "DIGITAL", revokedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      cardNumber: true,
      validUntil: true,
      revokedAt: true,
      tokenCiphertext: true,
      tokenNonce: true,
      tokenAuthTag: true,
      member: {
        select: {
          firstName: true,
          lastName: true,
          memberNumber: true,
          status: true,
          avatarUrl: true,
          category: { select: { name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!card) return null;

  const [cargos, branding, impresa] = await Promise.all([
    prisma.membershipCharge.findMany({
      where: { memberId },
      select: { concept: true, period: true, balanceArs: true },
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: card.workspace.id },
      select: { commercialName: true },
    }),
    prisma.memberCard.findFirst({
      where: { memberId, format: "PRINTED", revokedAt: null },
      orderBy: { issuedAt: "desc" },
      select: { fulfillmentState: true, validUntil: true },
    }),
  ]);

  const duesCharges: DuesCharge[] = cargos.map((c) => ({
    concept: String(c.concept),
    period: c.period,
    balanceMinor: decimalArsToMinor(c.balanceArs),
  }));

  const status = computeCardStatus({
    memberStatus: String(card.member.status) as MemberInstitutionalStatus,
    revokedAt: card.revokedAt,
    validUntil: card.validUntil,
    delinquency: computeDelinquency(duesCharges),
    now: new Date(),
  });

  const token = openCardToken({
    ciphertext: card.tokenCiphertext ?? undefined,
    nonce: card.tokenNonce ?? undefined,
    authTag: card.tokenAuthTag ?? undefined,
  });

  return {
    cardNumber: card.cardNumber,
    memberNumber: card.member.memberNumber,
    fullName: `${card.member.firstName} ${card.member.lastName}`.trim(),
    institutionName: branding?.commercialName?.trim() || card.workspace.name,
    category: card.member.category?.name ?? null,
    photoUrl: card.member.avatarUrl,
    validUntil: card.validUntil,
    enabled: status.enabled,
    disabledReason: status.reason ? explainDisabled(status.reason) : null,
    verificationUrl: token ? `${baseUrl.replace(/\/+$/, "")}/c/${token}` : null,
    totalDueMinor: duesCharges.reduce((s, c) => s + c.balanceMinor, 0),
    printedState: (impresa?.fulfillmentState ?? null) as FulfillmentState | null,
    printedValidUntil: impresa?.validUntil ?? null,
  };
}
