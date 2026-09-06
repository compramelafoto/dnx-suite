import "server-only";
import { prisma } from "@repo/db";
import { computeDelinquency, type DuesCharge } from "./delinquency";
import { computeCardStatus, type CardStatus, type MemberInstitutionalStatus } from "./status";
import { decimalArsToMinor } from "@/lib/membership/money";
import { hashCardToken, looksLikeCardToken } from "./token";

/**
 * Lo que devuelve una consulta pública de carnet.
 *
 * **Nivel 1.** Solo lo que hace falta para responder "¿es socio y está habilitado?".
 * Cualquier dato que no sirva para eso no pertenece acá: quien escanea un QR en la puerta de
 * un evento no tiene por qué enterarse de que el socio debe tres cuotas.
 */
export type PublicCardView = {
  found: true;
  institutionName: string;
  /**
   * Isotipo de la institución. Es identidad, no un dato del socio: quien escanea en la puerta
   * de un evento tiene que reconocer de quién es la credencial antes de leer nada.
   */
  institutionLogoUrl: string | null;
  fullName: string;
  memberNumber: string;
  cardNumber: string;
  category: string | null;
  photoUrl: string | null;
  validUntil: Date;
  status: CardStatus;
};

export type CardLookupResult = PublicCardView | { found: false };

/**
 * Busca un carnet por el token del QR.
 *
 * El token se compara **por su hash**: en la base no está en claro, así que ni siquiera
 * quien la lea puede fabricar uno válido.
 */
export async function findCardByToken(token: string): Promise<CardLookupResult> {
  // Lo que no tiene forma de token no se busca: ahorra la consulta y no le da al que prueba
  // al azar ninguna señal de tiempo distinta.
  if (!looksLikeCardToken(token)) return { found: false };

  const card = await prisma.memberCard.findUnique({
    where: { tokenHash: hashCardToken(token) },
    select: {
      cardNumber: true,
      validUntil: true,
      revokedAt: true,
      member: {
        select: {
          id: true,
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
  if (!card) return { found: false };

  const cargos = await prisma.membershipCharge.findMany({
    where: { memberId: card.member.id },
    select: { concept: true, period: true, balanceArs: true },
  });
  const duesCharges: DuesCharge[] = cargos.map((c) => ({
    concept: String(c.concept),
    period: c.period,
    balanceMinor: decimalArsToMinor(c.balanceArs),
  }));

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: card.workspace.id },
    select: { commercialName: true, logoUrl: true },
  });

  const status = computeCardStatus({
    memberStatus: String(card.member.status) as MemberInstitutionalStatus,
    revokedAt: card.revokedAt,
    validUntil: card.validUntil,
    delinquency: computeDelinquency(duesCharges),
    now: new Date(),
  });

  return {
    found: true,
    institutionName: branding?.commercialName?.trim() || card.workspace.name,
    institutionLogoUrl: branding?.logoUrl?.trim() || null,
    fullName: `${card.member.firstName} ${card.member.lastName}`.trim(),
    memberNumber: card.member.memberNumber,
    cardNumber: card.cardNumber,
    category: card.member.category?.name ?? null,
    photoUrl: card.member.avatarUrl,
    validUntil: card.validUntil,
    status,
  };
}
