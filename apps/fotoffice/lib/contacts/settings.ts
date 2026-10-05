import "server-only";
import { prisma } from "@repo/db";

/**
 * El interruptor de "agendar en Google" de cada módulo.
 *
 * Apagar un interruptor NO borra nada: ni el grupo, ni los contactos, ni el vínculo. Los
 * contactos viven en la cuenta de otra persona, y una casilla de nuestra pantalla no puede
 * borrarle datos a nadie. Volver a encenderlo retoma donde había quedado.
 */

export type ContactSyncSetting = {
  moduleKey: string;
  enabled: boolean;
  googleGroupResourceName: string | null;
  lastSyncAt: Date | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  syncedContacts: number;
};

const CAMPOS = {
  moduleKey: true,
  enabled: true,
  googleGroupResourceName: true,
  lastSyncAt: true,
  lastSyncOk: true,
  lastSyncMessage: true,
  syncedContacts: true,
} as const;

export async function listContactSyncSettings(workspaceId: string): Promise<ContactSyncSetting[]> {
  return prisma.workspaceContactSyncSetting.findMany({ where: { workspaceId }, select: CAMPOS });
}

export async function getContactSyncSetting(
  workspaceId: string,
  moduleKey: string,
): Promise<ContactSyncSetting | null> {
  return prisma.workspaceContactSyncSetting.findUnique({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    select: CAMPOS,
  });
}

export async function setContactSyncEnabled(input: {
  workspaceId: string;
  moduleKey: string;
  enabled: boolean;
  userId: number;
}): Promise<void> {
  const ahora = new Date();
  await prisma.workspaceContactSyncSetting.upsert({
    where: {
      workspaceId_moduleKey: { workspaceId: input.workspaceId, moduleKey: input.moduleKey },
    },
    create: {
      workspaceId: input.workspaceId,
      moduleKey: input.moduleKey,
      enabled: input.enabled,
      enabledByUserId: input.enabled ? input.userId : null,
      enabledAt: input.enabled ? ahora : null,
    },
    // `googleGroupResourceName` no se toca: si vuelven a encenderlo, los contactos siguen
    // en el grupo que ya existía y no se crea uno nuevo.
    update: {
      enabled: input.enabled,
      ...(input.enabled ? { enabledByUserId: input.userId, enabledAt: ahora } : {}),
    },
  });
}

export async function saveGroupResourceName(
  workspaceId: string,
  moduleKey: string,
  groupResourceName: string,
): Promise<void> {
  await prisma.workspaceContactSyncSetting.update({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    data: { googleGroupResourceName: groupResourceName },
  });
}

export async function recordSyncResult(input: {
  workspaceId: string;
  moduleKey: string;
  ok: boolean;
  message: string | null;
  syncedContacts: number;
}): Promise<void> {
  await prisma.workspaceContactSyncSetting.update({
    where: {
      workspaceId_moduleKey: { workspaceId: input.workspaceId, moduleKey: input.moduleKey },
    },
    data: {
      lastSyncAt: new Date(),
      lastSyncOk: input.ok,
      lastSyncMessage: input.message,
      syncedContacts: input.syncedContacts,
    },
  });
}

/**
 * Los workspaces con ALGÚN módulo encendido, sin repetir.
 *
 * Sin el `Set`, un workspace con dos módulos encendidos leería la agenda entera dos veces
 * por corrida — el doble de cuota para el mismo resultado.
 */
export async function listWorkspacesWithContactSync(): Promise<string[]> {
  const filas = await prisma.workspaceContactSyncSetting.findMany({
    where: { enabled: true },
    select: { workspaceId: true },
  });
  return [...new Set(filas.map((f) => f.workspaceId))];
}
