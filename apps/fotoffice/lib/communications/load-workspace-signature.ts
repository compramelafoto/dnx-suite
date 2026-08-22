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
  return (await loadWorkspaceEmailContext(workspaceId)).signature;
}

export type WorkspaceEmailContext = {
  /**
   * Nombre para mostrar, con la MISMA precedencia que usa la firma: nombre comercial, si no
   * el del workspace, si no el del producto. Nunca el identificador interno.
   */
  organizationName: string;
  signature: RenderedEmailSignature | null;
};

/**
 * Igual que `loadWorkspaceSignature`, pero devuelve además el nombre de la organización.
 * Lo necesita el asunto del email de prueba, y calcularlo aparte duplicaría la regla de
 * precedencia que ya vive en `toEmailSignatureData`.
 */
export async function loadWorkspaceEmailContext(
  workspaceId: string,
): Promise<WorkspaceEmailContext> {
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

  const workspaceName = workspace?.name ?? "";
  if (!branding) {
    return { organizationName: workspaceName.trim() || "FotoOffice", signature: null };
  }

  const data = toEmailSignatureData(branding, workspaceName);
  return { organizationName: data.organizationName, signature: renderEmailSignature(data) };
}
