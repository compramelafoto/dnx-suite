import "server-only";
import { prisma } from "@repo/db";

/** El puente entre una persona de FOTOFFICE y su contacto de Google. */

export type ContactLink = {
  id: string;
  moduleKey: string;
  sourceType: string;
  sourceId: string;
  resourceName: string;
  etag: string | null;
  localFingerprint: string;
  remoteFingerprint: string;
  status: string;
};

const CAMPOS = {
  id: true,
  moduleKey: true,
  sourceType: true,
  sourceId: true,
  resourceName: true,
  etag: true,
  localFingerprint: true,
  remoteFingerprint: true,
  status: true,
} as const;

export async function listLinks(workspaceId: string, moduleKey: string): Promise<ContactLink[]> {
  return prisma.workspaceContactLink.findMany({
    where: { workspaceId, moduleKey },
    select: CAMPOS,
  });
}

export async function createLink(input: {
  workspaceId: string;
  moduleKey: string;
  sourceType: string;
  sourceId: string;
  resourceName: string;
  etag: string | null;
  localFingerprint: string;
  remoteFingerprint: string;
}): Promise<void> {
  await prisma.workspaceContactLink.create({
    data: { ...input, status: "LINKED", lastPushedAt: new Date() },
  });
}

export async function updateLink(
  workspaceId: string,
  id: string,
  data: {
    etag?: string | null;
    localFingerprint?: string;
    remoteFingerprint?: string;
    status?: string;
    lastPushedAt?: Date;
    lastPulledAt?: Date;
  },
): Promise<void> {
  // El `where` lleva ambos `workspaceId` e `id` para aislar por institución. Sin el
  // `workspaceId`, una institución podría tocar vínculos de otra si conoce el ID global.
  // Igual que `markRemoteDeleted`: usar `updateMany` con el filtro compuesto.
  await prisma.workspaceContactLink.updateMany({
    where: { workspaceId, id },
    data,
  });
}

/**
 * Alguien borró el contacto en Google. Se anota y se deja así.
 *
 * No se recrea ni se borra el socio: recrearlo sería desobedecer a quien lo borró, y borrar
 * al socio sería dejar que una agenda mande sobre el padrón.
 */
export async function markRemoteDeleted(
  workspaceId: string,
  resourceName: string,
): Promise<void> {
  await prisma.workspaceContactLink.updateMany({
    where: { workspaceId, resourceName },
    data: { status: "REMOTE_DELETED" },
  });
}
