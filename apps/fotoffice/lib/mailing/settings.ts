import "server-only";
import { prisma } from "@repo/db";

export type MailingSettings = { bulkEnabled: boolean; weeklyBlogDigest: boolean; requireApproval: boolean };

const DEFAULTS: MailingSettings = { bulkEnabled: false, weeklyBlogDigest: false, requireApproval: false };

/** Interruptores de la institución. Sin fila (o si la tabla todavía no existe): todo apagado. */
export async function getMailingSettings(workspaceId: string): Promise<MailingSettings> {
  try {
    const row = await prisma.fotofficeMailingSettings.findUnique({
      where: { workspaceId },
      select: { bulkEnabled: true, weeklyBlogDigest: true, requireApproval: true },
    });
    return row ?? DEFAULTS;
  } catch (error) {
    console.error("[fotoffice][correo] no se pudieron leer los interruptores", {
      workspaceId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return DEFAULTS;
  }
}

export async function updateMailingSettings(workspaceId: string, patch: Partial<MailingSettings>): Promise<MailingSettings> {
  const row = await prisma.fotofficeMailingSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, ...DEFAULTS, ...patch },
    update: patch,
    select: { bulkEnabled: true, weeklyBlogDigest: true, requireApproval: true },
  });
  return row;
}
