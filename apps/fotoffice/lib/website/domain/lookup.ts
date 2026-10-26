import "server-only";
import { prisma } from "@repo/db";
import type { ReglaRedireccion } from "@/lib/website/redirecciones-reglas";
import { reglasDelWorkspace } from "@/lib/website/redirecciones";

/**
 * Dominio propio → slug público de la institución y las redirecciones de su sitio. Lo usa la ruta
 * `/api/dominio-propio`, que es a quien le pregunta el `proxy.ts`. Nunca tira: si la base falla
 * (o la tabla todavía no existe), el dominio queda sin dueño y la visita sigue sin tocar.
 *
 * Las redirecciones: el proxy las consulta antes de reescribir a
 * `/w/<slug>/…` (así `/cursos` viejo lleva a `/capacitate` aunque el módulo de cursos ocupe
 * `/cursos`). Si las redirecciones no se pueden leer, el dominio se resuelve igual, sin ellas.
 */
export async function siteForCustomDomain(domain: string): Promise<{ slug: string | null; redirecciones: ReglaRedireccion[] }> {
  let row: { workspaceId: string; workspace: { fotofficeBranding: { publicSlug: string } | null } } | null;
  try {
    row = await prisma.fotofficeWorkspaceDomain.findUnique({
      where: { domain },
      select: { workspaceId: true, workspace: { select: { fotofficeBranding: { select: { publicSlug: true } } } } },
    });
  } catch {
    return { slug: null, redirecciones: [] };
  }
  const slug = row?.workspace.fotofficeBranding?.publicSlug ?? null;
  if (!row || !slug) return { slug: null, redirecciones: [] };
  const redirecciones = await reglasDelWorkspace(row.workspaceId).catch((err: unknown) => {
    console.error("[fotoffice][website] no se pudieron leer las redirecciones del dominio:", domain, err);
    return [];
  });
  return { slug, redirecciones };
}
