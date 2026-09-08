import "server-only";
import { prisma } from "@repo/db";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  requireIntegrationsMasterKey,
} from "./vault";

/**
 * Única puerta a `WorkspaceIntegration`.
 *
 * Ninguna pantalla, ruta ni acción consulta esa tabla por su cuenta: si lo hicieran,
 * tarde o temprano alguna leería el token cifrado y lo pasaría a un lugar donde no
 * corresponde. Acá el refresh token sale por una sola función, `readRefreshToken`, y
 * los resúmenes que van a las pantallas no lo incluyen jamás.
 *
 * Toda consulta lleva `workspaceId`: una institución no puede leer la cuenta de otra.
 */

export type IntegrationStatusValue = "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";

export type IntegrationSummary = {
  integrationKey: string;
  accountEmail: string;
  grantedScopes: string[];
  status: IntegrationStatusValue;
  connectedAt: Date;
  lastUsedAt: Date | null;
};

type IntegrationRow = {
  integrationKey: string;
  accountEmail: string;
  grantedScopes: string[];
  status: string;
  connectedAt: Date;
  lastUsedAt: Date | null;
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

function toSummary(row: IntegrationRow): IntegrationSummary {
  return {
    integrationKey: row.integrationKey,
    accountEmail: row.accountEmail,
    grantedScopes: row.grantedScopes,
    status: row.status as IntegrationStatusValue,
    connectedAt: row.connectedAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export async function saveIntegration(input: {
  workspaceId: string;
  integrationKey: string;
  provider: string;
  accountEmail: string;
  accountExternalId: string;
  grantedScopes: string[];
  refreshToken: string;
  connectedByUserId: number | null;
}): Promise<void> {
  // Primero cifrar: si falta la clave maestra, se corta antes de escribir nada.
  const blob = encryptIntegrationSecret(input.refreshToken, requireIntegrationsMasterKey());
  const datos = {
    provider: input.provider,
    accountEmail: input.accountEmail,
    accountExternalId: input.accountExternalId,
    grantedScopes: input.grantedScopes,
    ciphertext: blob.ciphertext,
    nonce: blob.nonce,
    authTag: blob.authTag,
    keyVersion: blob.keyVersion,
    status: "ACTIVE",
    connectedByUserId: input.connectedByUserId,
    revokedAt: null,
  };
  await prisma.workspaceIntegration.upsert({
    where: {
      workspaceId_integrationKey: {
        workspaceId: input.workspaceId,
        integrationKey: input.integrationKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      integrationKey: input.integrationKey,
      ...datos,
    },
    update: { ...datos, connectedAt: new Date() },
  });
}

export async function getIntegrationSummary(
  workspaceId: string,
  integrationKey: string,
): Promise<IntegrationSummary | null> {
  const row = (await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  })) as IntegrationRow | null;
  return row ? toSummary(row) : null;
}

export async function listIntegrationSummaries(workspaceId: string): Promise<IntegrationSummary[]> {
  const rows = (await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
  })) as IntegrationRow[];
  return rows.map(toSummary);
}

/**
 * La única función que devuelve la credencial en claro. Quien la llame es responsable de
 * no propagarla: no se loguea, no se devuelve por HTTP y no se guarda en ningún lado.
 */
export async function readRefreshToken(
  workspaceId: string,
  integrationKey: string,
): Promise<string | null> {
  const row = (await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  })) as IntegrationRow | null;
  if (!row) return null;
  return decryptIntegrationSecret(
    {
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    },
    requireIntegrationsMasterKey(),
  );
}

/**
 * El permiso dejó de valer (lo revocaron desde la cuenta de Google). No se borra la fila:
 * el dueño tiene que ver que la integración existía y que hay que volver a conectarla.
 */
export async function markIntegrationNeedsReconsent(
  workspaceId: string,
  integrationKey: string,
): Promise<void> {
  await prisma.workspaceIntegration.update({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
    data: { status: "NEEDS_RECONSENT" },
  });
}

export async function touchIntegrationUsed(
  workspaceId: string,
  integrationKey: string,
): Promise<void> {
  await prisma.workspaceIntegration.update({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
    data: { lastUsedAt: new Date() },
  });
}

/** Devuelve la credencial para poder revocarla contra Google, y borra la fila. */
export async function deleteIntegration(
  workspaceId: string,
  integrationKey: string,
): Promise<string | null> {
  const refreshToken = await readRefreshToken(workspaceId, integrationKey).catch(() => null);
  const existe = await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  });
  if (!existe) return null;
  await prisma.workspaceIntegration.delete({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  });
  return refreshToken;
}
