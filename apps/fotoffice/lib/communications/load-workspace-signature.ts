import { prisma } from "@repo/db";
import { renderEmailSignature, type RenderedEmailSignature } from "@repo/communications/signature";
import { toEmailSignatureData } from "./workspace-signature";

/**
 * Carga el branding del workspace y devuelve la firma ya renderizada.
 *
 * Devuelve `null` si el workspace no tiene branding cargado: el email sale sin firma en vez
 * de fallar. Confirmar una inscripción pagada no puede depender de que la firma exista.
 */
export async function loadWorkspaceSignature(
  workspaceId: string,
): Promise<RenderedEmailSignature | null> {
  const [branding, workspace] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: {
        commercialName: true,
        logoUrl: true,
        contactEmail: true,
        phone: true,
        whatsapp: true,
        instagram: true,
        website: true,
        city: true,
        accentColor: true,
        emailSignatureNote: true,
      },
    }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
  ]);

  if (!branding) return null;

  return renderEmailSignature(toEmailSignatureData(branding, workspace?.name ?? ""));
}
