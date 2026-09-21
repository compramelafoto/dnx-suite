import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicSite } from "@/lib/website/public-site";
import { PublicSiteShell } from "@/components/website/render/public-site-shell";

type Props = { children: ReactNode; params: Promise<{ workspaceSlug: string }> };

/**
 * El armazón de todo lo público de un workspace. Resuelve el sitio UNA vez por request y se lo
 * presta a todas las páginas de abajo, así ninguna vuelve a consultar branding ni módulos.
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

  // El menú necesita saber en qué página estás. Un layout no recibe la ruta, y estas cabeceras
  // NO llegan en este entorno (Next 16.2.1 no las agrega acá) — se comprobó en el navegador.
  // Se dejan como mejor esfuerzo por si algún día existen, pero quien resuelve la página actual
  // es `WebsiteHeaderNavClient` con `usePathname()` en el cliente (ver `website-header-nav-client.tsx`).
  const h = await headers();
  const currentPath = h.get("x-invoke-path") ?? h.get("x-pathname") ?? `/w/${workspaceSlug}`;

  return (
    <PublicSiteShell site={site} currentPath={currentPath}>
      {children}
    </PublicSiteShell>
  );
}
