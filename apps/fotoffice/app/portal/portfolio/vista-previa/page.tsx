import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { loadPublicSite } from "@/lib/website/public-site";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { loadPortfolioPreview } from "@/lib/portfolio/public-queries";
import { PortfolioShowcase } from "@/components/public/portfolio/portfolio-showcase";
import type { CSSProperties } from "react";

export const metadata = { title: "Vista previa de mi portfolio" };
export const dynamic = "force-dynamic";

/**
 * Cómo se vería el portfolio en el sitio, antes de publicarlo.
 *
 * Dibuja el **mismo** `PortfolioShowcase` que la página pública, con los **mismos** colores del
 * sitio de la institución. Si fuera un armado aparte, mostraría algo que no es, y una vista previa
 * que miente es peor que no tenerla.
 *
 * Saltea las siete condiciones a propósito: el sentido de esto es verlo antes de prender el
 * interruptor. Nadie más puede entrar — la ficha sale de la sesión, no de un parámetro.
 */
export default async function PortfolioPreviewPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, PORTFOLIO_MODULE_KEY))) {
    redirect("/portal");
  }

  const [portfolio, branding] = await Promise.all([
    loadPortfolioPreview({ workspaceId: context.workspace.id, memberId: context.member.id }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { publicSlug: true },
    }),
  ]);

  if (!portfolio || portfolio.photos.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Vista previa</h1>
        <p className="fo-alert-warning text-sm">
          Todavía no subiste ninguna foto, así que no hay nada que mostrar. Subí al menos una y
          volvé.
        </p>
        <Link href="/portal/portfolio" className="fo-btn fo-btn-secondary text-sm">
          Volver a mi portfolio
        </Link>
      </main>
    );
  }

  // Los colores reales del sitio de la institución. Sin esto la vista previa se vería con la
  // paleta del panel, que no es donde esta página va a vivir.
  const site = branding?.publicSlug ? await loadPublicSite(branding.publicSlug) : null;
  const colores = site
    ? ({
        "--wsite-primary": site.colors.primaryColor,
        "--wsite-secondary": site.colors.secondaryColor,
        "--wsite-bg": site.colors.backgroundColor,
        "--wsite-text": site.colors.textColor,
        "--wsite-accent": site.colors.accentColor,
        ...websiteDesignCssVars(site.designPresets),
      } as CSSProperties)
    : ({} as CSSProperties);

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-4 py-3">
        <div>
          <p className="text-sm font-medium">Vista previa</p>
          <p className="text-xs text-[var(--fo-muted)]">
            Así se vería tu portfolio en el sitio. Nadie más lo ve todavía.
          </p>
        </div>
        <Link href="/portal/portfolio" className="fo-btn fo-btn-secondary text-sm">
          Volver a editar
        </Link>
      </div>

      <main
        style={{ ...colores, backgroundColor: "var(--wsite-bg)", color: "var(--wsite-text)" }}
        className="min-h-screen"
      >
        <div className="mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
          <PortfolioShowcase portfolio={portfolio} />
        </div>
      </main>
    </div>
  );
}
