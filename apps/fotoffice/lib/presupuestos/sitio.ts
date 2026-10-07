import "server-only";
import { prisma } from "@repo/db";

/**
 * Datos públicos de la organización para el enlace de un presupuesto: dónde vive su sitio
 * (dominio propio conectado o `/w/<slug>`) y su marca (nombre, logo, WhatsApp, correo).
 * Nada de esto es interno: es lo mismo que muestra su sitio público.
 */
export type SitioDelPresupuesto = {
  workspaceId: string;
  slug: string | null;
  customDomain: string | null;
  nombre: string;
  logoUrl: string | null;
  whatsapp: string | null;
  email: string | null;
};

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function sitioDelWorkspace(workspaceId: string): Promise<SitioDelPresupuesto | null> {
  const [workspace, dominio] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        fotofficeBranding: { select: { publicSlug: true, commercialName: true, logoUrl: true, whatsapp: true, contactEmail: true } },
      },
    }),
    prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId }, select: { domain: true, status: true } }),
  ]);
  if (!workspace) return null;
  const b = workspace.fotofficeBranding;
  return {
    workspaceId,
    slug: limpio(b?.publicSlug),
    customDomain: dominio?.status === "CONNECTED" ? limpio(dominio.domain) : null,
    nombre: limpio(b?.commercialName) ?? workspace.name,
    logoUrl: limpio(b?.logoUrl),
    whatsapp: limpio(b?.whatsapp),
    email: limpio(b?.contactEmail),
  };
}

/** El workspace de un slug público (el de la dirección `/w/<slug>`), o null. */
export async function workspaceDelSlug(slug: unknown): Promise<string | null> {
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(slug)) return null;
  const b = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { publicSlug: slug }, select: { workspaceId: true } });
  return b?.workspaceId ?? null;
}
