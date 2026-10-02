import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PORTFOLIO_MODULE_KEY, PORTFOLIO_PUBLIC_SEGMENT } from "@/lib/portfolio/constants";
import { loadPortfolioForMember } from "@/lib/portfolio/repository";
import { PortfolioStatusCard } from "@/components/portal/portfolio/portfolio-status-card";
import { PortfolioUploader } from "@/components/portal/portfolio/portfolio-uploader";
import { PortfolioPhotoGrid } from "@/components/portal/portfolio/portfolio-photo-grid";
import { PortfolioPublishToggle } from "@/components/portal/portfolio/portfolio-publish-toggle";

export const metadata = { title: "Mi portfolio" };
export const dynamic = "force-dynamic";

/**
 * Donde una persona arma su portfolio.
 *
 * Cuatro bloques, en el orden en que importan:
 *
 * 1. **El estado.** Si está al aire, y si no, cuál de las siete condiciones falta y qué hacer.
 *    Va primero porque es la pregunta que trae a alguien a esta pantalla.
 * 2. **Subir fotos.**
 * 3. **Las fotos**, para ordenar, destacar, titular y borrar.
 * 4. **El interruptor de publicar**, al final: se prende cuando lo demás ya está.
 *
 * El portfolio se crea recién cuando alguien entra acá — `loadPortfolioForMember` no lo crea, sólo
 * lo lee, y devuelve `id: null` mientras no exista. La fila nace en la primera acción real (subir
 * una foto, prender el interruptor), así "tener portfolio" no significa "figurar en el padrón".
 */
export default async function PortalPortfolioPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, PORTFOLIO_MODULE_KEY))) {
    redirect("/portal");
  }

  const [portfolio, branding] = await Promise.all([
    loadPortfolioForMember({
      workspaceId: context.workspace.id,
      memberId: context.member.id,
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { publicSlug: true },
    }),
  ]);

  // El enlace a la ficha pública sólo tiene sentido si la institución tiene sitio y el portfolio ya
  // existe. Ofrecer un enlace que da 404 es peor que no ofrecerlo.
  const publicHref =
    branding?.publicSlug && portfolio.publicSlug
      ? `/w/${branding.publicSlug}/${PORTFOLIO_PUBLIC_SEGMENT}/${portfolio.publicSlug}`
      : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mi portfolio</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Tus fotos, publicadas en el sitio de la institución. Vos elegís cuáles, en qué orden y
          cuándo se ven.
        </p>
      </header>

      <PortfolioStatusCard visibility={portfolio.visibility} publicHref={publicHref} />

      <PortfolioUploader photoCount={portfolio.photos.length} />

      <PortfolioPhotoGrid photos={portfolio.photos} />

      <PortfolioPublishToggle
        published={portfolio.memberPublished}
        canPublish={portfolio.photos.length > 0}
      />
    </main>
  );
}
