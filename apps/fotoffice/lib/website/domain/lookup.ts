import "server-only";
import { prisma } from "@repo/db";

/**
 * Dominio propio → slug público de la institución. Lo usa la ruta `/api/dominio-propio`, que es
 * a quien le pregunta el `proxy.ts`. Nunca tira: si la base falla (o la tabla todavía no
 * existe), devuelve null y la visita sigue como si el dominio no fuera de nadie.
 */
export async function slugForCustomDomain(domain: string): Promise<string | null> {
  try {
    const row = await prisma.fotofficeWorkspaceDomain.findUnique({
      where: { domain },
      select: { workspace: { select: { fotofficeBranding: { select: { publicSlug: true } } } } },
    });
    return row?.workspace.fotofficeBranding?.publicSlug ?? null;
  } catch {
    return null;
  }
}
