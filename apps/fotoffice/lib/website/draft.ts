import { prisma } from "@repo/db";

/**
 * Garantiza que exista la fila de borrador del sitio para el workspace (idempotente). Se llama
 * desde cada pantalla del CMS que necesita leer o mostrar `draftUpdatedAt` para el guardado con
 * concurrencia optimista — así el usuario nunca ve la pantalla sin una referencia válida.
 */
export async function ensureWebsiteDraft(workspaceId: string) {
  return prisma.fotofficeWorkspaceWebsite.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId, navJson: { items: [{ id: "home", label: "Home", type: "home" }] } },
  });
}
