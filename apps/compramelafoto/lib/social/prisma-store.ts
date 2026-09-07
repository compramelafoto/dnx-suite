import type { SocialAccount } from "@repo/social-publisher";
import { Prisma, prisma } from "@repo/db";

/**
 * Entidad de los borradores de permiso del fotógrafo (Task 9): son datos, nunca
 * publicaciones. Se usa acá también para excluirlos de `processDue` en el worker.
 */
export const ALBUM_SOCIAL_CONSENT_ENTITY_TYPE = "ALBUM_SOCIAL_CONSENT";

export function toSocialAccount(account: {
  id: string;
  platform: string;
  ownerUserId: number;
  externalAccountId: string;
  businessId: string | null;
  username: string | null;
  displayName: string | null;
  scopes: string[];
  status: string;
  expiresAt: Date | null;
  lastValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SocialAccount {
  return {
    ...account,
    platform: account.platform as SocialAccount["platform"],
    status: account.status as SocialAccount["status"],
  };
}

/**
 * Resuelve la cuenta de Instagram de CompraMeLaFoto: primero `CLF_SOCIAL_ACCOUNT_ID` si
 * está configurada; si no, la primera cuenta activa con grant para COMPRAMELAFOTO (o "*").
 * Mismo criterio que `resolveClickatonInstagramAccount` en Clickatón.
 */
export async function resolveClfInstagramAccount() {
  const configuredId = process.env.CLF_SOCIAL_ACCOUNT_ID?.trim();
  if (configuredId) {
    return prisma.dnxSocialAccount.findFirst({
      where: { id: configuredId, platform: "INSTAGRAM", status: "ACTIVE" },
    });
  }
  return prisma.dnxSocialAccount.findFirst({
    where: {
      platform: "INSTAGRAM",
      status: "ACTIVE",
      grants: { some: { application: { in: ["COMPRAMELAFOTO", "*"] }, canPublish: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function logSocialRequest(
  publishRequestId: string,
  action: string,
  actorUserId?: number | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.dnxSocialPublishLog.create({
    data: {
      publishRequestId,
      action,
      actorUserId: actorUserId ?? null,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Agrupa el acceso a Prisma que necesita el worker de publicación social de CLF.
 *
 * No es el `SocialPublisherStore` en memoria de `@repo/social-publisher` (ese es para
 * tests unitarios del motor): en producción, igual que en Clickatón, el worker habla
 * contra Prisma directamente. Esto solo agrupa las funciones de arriba para que el
 * worker no importe cada una suelta.
 */
export function createClfSocialStore() {
  return {
    resolveAccount: resolveClfInstagramAccount,
    toSocialAccount,
    logRequest: logSocialRequest,
  };
}
