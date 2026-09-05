import "server-only";
import { prisma } from "@repo/db";

/**
 * Canales por los que el socio puede escribirle a la institución.
 *
 * Sale del branding del workspace, que es la misma fuente que usan el sitio público y la
 * firma de los emails. No hay un campo de contacto propio del portal a propósito: dos
 * lugares donde cargar el mismo teléfono terminan con dos teléfonos distintos.
 */

export type WorkspaceContactChannels = {
  /** Tal como lo cargó la institución: puede ser un número o una URL de wa.me. */
  whatsapp: string | null;
  contactEmail: string | null;
};

export async function loadWorkspaceContactChannels(
  workspaceId: string,
): Promise<WorkspaceContactChannels> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { whatsapp: true, contactEmail: true },
  });

  return {
    whatsapp: branding?.whatsapp ?? null,
    contactEmail: branding?.contactEmail ?? null,
  };
}
