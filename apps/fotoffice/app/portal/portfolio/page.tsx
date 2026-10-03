import Link from "next/link";
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
import { PortfolioInstagramForm } from "@/components/portal/portfolio/portfolio-instagram-form";
import { PortfolioVideosForm } from "@/components/portal/portfolio/portfolio-videos-form";
import { PortfolioPresentation } from "@/components/portal/portfolio/portfolio-presentation";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { normalizeArgentineWhatsappNumber } from "@/lib/portfolio/whatsapp";

export const metadata = { title: "Mi portfolio" };
export const dynamic = "force-dynamic";

/**
 * Donde una persona arma su portfolio.
 *
 * Los bloques, en el orden en que importan:
 *
 * 1. **El estado.** Si está al aire, y si no, cuál de las siete condiciones falta y qué hacer.
 *    Va primero porque es la pregunta que trae a alguien a esta pantalla.
 * 2. **Cómo te presentás**: foto, logo, presentación, rubros y redes. Son campos de la ficha del
 *    socio —los mismos que "Mi perfil"—, no del portfolio, pero se ven arriba de las fotos en la
 *    página pública, y no tenerlos acá obligaba a adivinar dónde vivían.
 * 3. **Subir fotos.**
 * 4. **Las fotos**, para ordenar, destacar, titular y borrar.
 * 5. **Videos** y **la franja de Instagram.**
 * 6. **El interruptor de publicar**, al final: se prende cuando lo demás ya está.
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

  const [portfolio, branding, vocabulario, presentacion] = await Promise.all([
    loadPortfolioForMember({
      workspaceId: context.workspace.id,
      memberId: context.member.id,
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { publicSlug: true },
    }),
    loadPersonVocabulary(context.workspace.id),
    // Lo que se ve arriba de las fotos en la página pública. Vive en la ficha del socio, no en el
    // portfolio: por eso hasta ahora sólo se editaba desde "Mi perfil".
    prisma.member.findUnique({
      where: { id: context.member.id },
      select: {
        phone: true,
        avatarUrl: true,
        profilePhotoUrl: true,
        businessName: true,
        businessLogoUrl: true,
        bio: true,
        specialties: true,
        website: true,
        instagram: true,
        tiktok: true,
        facebook: true,
        youtube: true,
        linkedin: true,
        directoryOptIn: true,
        studioStreet: true,
        studioCity: true,
        studioProvince: true,
        studioPostalCode: true,
        studioLat: true,
        studioLng: true,
      },
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mi portfolio</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            Tus fotos, publicadas en el sitio de la institución. Vos elegís cuáles, en qué orden y
            cuándo se ven.
          </p>
        </div>

        {/*
          La vista previa se ofrece sólo cuando hay algo que ver. Un botón que lleva a una pantalla
          vacía enseña a ignorar los botones.
        */}
        {portfolio.photos.length > 0 ? (
          <Link
            href="/portal/portfolio/vista-previa"
            className="fo-btn fo-btn-secondary shrink-0 text-sm"
          >
            Ver cómo queda
          </Link>
        ) : null}
      </header>

      <PortfolioStatusCard visibility={portfolio.visibility} publicHref={publicHref} />

      {/*
        Va antes de las fotos porque es el orden en que se lee la página pública: primero quién
        sos, después tu obra. La sección se abre sola cuando falta algo.
      */}
      {presentacion ? (
        <PortfolioPresentation
          institutionName={context.workspace.name}
          vocabulary={vocabulario}
          displayName={`${context.member.firstName} ${context.member.lastName}`.trim()}
          profilePhotoUrl={presentacion.profilePhotoUrl}
          carnetPhotoUrl={presentacion.avatarUrl}
          businessLogoUrl={presentacion.businessLogoUrl}
          whatsappListo={normalizeArgentineWhatsappNumber(presentacion.phone) !== null}
          defaults={{
            businessName: presentacion.businessName,
            bio: presentacion.bio,
            specialties: presentacion.specialties,
            website: presentacion.website,
            instagram: presentacion.instagram,
            tiktok: presentacion.tiktok,
            facebook: presentacion.facebook,
            youtube: presentacion.youtube,
            linkedin: presentacion.linkedin,
            directoryOptIn: presentacion.directoryOptIn,
            studioStreet: presentacion.studioStreet,
            studioCity: presentacion.studioCity,
            studioProvince: presentacion.studioProvince,
            studioPostalCode: presentacion.studioPostalCode,
            // Las coordenadas guardadas vuelven por el mismo campo donde se pegó el enlace.
            studioMapsUrl:
              presentacion.studioLat !== null && presentacion.studioLng !== null
                ? `${presentacion.studioLat}, ${presentacion.studioLng}`
                : "",
          }}
        />
      ) : null}

      <PortfolioUploader photoCount={portfolio.photos.length} />

      <PortfolioPhotoGrid photos={portfolio.photos} />

      <PortfolioVideosForm urls={portfolio.videoUrls} />

      <PortfolioInstagramForm
        enabled={portfolio.instagramEnabled}
        postUrls={portfolio.instagramPostUrls}
      />

      <PortfolioPublishToggle
        published={portfolio.memberPublished}
        canPublish={portfolio.photos.length > 0}
      />
    </main>
  );
}
