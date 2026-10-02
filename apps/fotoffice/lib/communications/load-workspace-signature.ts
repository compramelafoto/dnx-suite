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
  /**
   * Datos de contacto del branding, limpios (null si faltan). Los usan las plantillas de
   * mensajes (variables de la organización y "responder a"). Sin branding, todo null.
   * `loadWorkspaceEmailContext` siempre lo completa; es opcional sólo para que los contextos
   * armados a mano (pruebas, otros llamadores) sigan siendo válidos.
   */
  contact?: WorkspaceContact;
};

export type WorkspaceContact = {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
};

const SIN_CONTACTO: WorkspaceContact = { email: null, phone: null, whatsapp: null, website: null, instagram: null, city: null };

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

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
    return { organizationName: workspaceName.trim() || "FotoOffice", signature: null, contact: { ...SIN_CONTACTO } };
  }

  const data = toEmailSignatureData(branding, workspaceName);
  return {
    organizationName: data.organizationName,
    signature: renderEmailSignature(data),
    contact: {
      email: limpio(branding.contactEmail),
      phone: limpio(branding.phone),
      whatsapp: limpio(branding.whatsapp),
      website: limpio(branding.website),
      instagram: limpio(branding.instagram),
      city: limpio(branding.city),
    },
  };
}
