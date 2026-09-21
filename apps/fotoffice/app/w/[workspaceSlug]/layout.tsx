import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { loadPublicSite } from "@/lib/website/public-site";
import { PublicSiteShell } from "@/components/website/render/public-site-shell";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El armazón de todo lo público de un workspace. Resuelve el sitio UNA vez por request y arma
 * con eso el encabezado, el menú y el pie — pero cada página de módulo, debajo, vuelve a
 * consultar branding y módulos por su cuenta (ver esas páginas bajo `app/w/[workspaceSlug]/`);
 * lo único que este layout evita repetir es el marco visual.
 *
 * Nunca pide sesión: `requireWebsiteContext` es del panel y redirige a /dashboard.
 *
 * Si el módulo Sitio web está apagado o nunca se publicó, el armazón igual se dibuja — con el
 * menú de los módulos que sí estén habilitados. Lo que cambia en ese caso es la portada, no el
 * marco: una institución que sólo vende cursos sigue teniendo su /w/slug/cursos con cara de
 * sitio (ver la tabla de la sección 4 del spec).
 */
export default async function PublicWorkspaceLayout({ children, params }: Props) {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  return <PublicSiteShell site={site}>{children}</PublicSiteShell>;
}
