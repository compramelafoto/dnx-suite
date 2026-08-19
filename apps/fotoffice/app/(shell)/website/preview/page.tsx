import Link from "next/link";
import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";

/**
 * Vista previa del BORRADOR (nunca de la versión publicada) — ver Parte 11 del pedido. Ruta
 * protegida: hereda el gate de `(shell)/layout.tsx` (auth + acceso a la app) y además
 * `loadWebsiteCmsContext` exige el workspace activo con el módulo Website habilitado. No usa
 * `WebsiteShell` a propósito: debe parecerse al sitio, no al panel de administración. El sitio
 * público real (`/w/[slug]`) NO se toca en esta etapa — este renderer solo se usa acá.
 */
export default async function WebsitePreviewPage() {
  const { workspace, sections } = await loadWebsiteCmsContext();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { primaryColor: true, secondaryColor: true, backgroundColor: true, textColor: true, accentColor: true },
  });
  const colors = resolveWebsiteColors(branding);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[var(--fo-text)] px-4 py-2.5 text-white text-sm">
        <span>Vista previa del borrador — esto todavía no es lo publicado.</span>
        <Link href="/website" className="underline underline-offset-2 shrink-0">
          Volver al editor
        </Link>
      </div>
      <WebsitePageRenderer blocks={sections.pages.home ?? []} colors={colors} />
    </div>
  );
}
