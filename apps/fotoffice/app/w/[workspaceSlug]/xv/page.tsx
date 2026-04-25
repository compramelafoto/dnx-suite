import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isPrismaDbUnavailableError } from "@/lib/prisma-errors";
import { getAuthUser } from "@/lib/auth";
import { fotofficeLogoutAction } from "@/app/actions/auth";
import { PublicServiceLeadForm } from "./public-service-lead-form";

type Props = { params: Promise<{ workspaceSlug: string }> };

export default async function PublicXvLandingPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const authUser = await getAuthUser();

  let branding:
    | {
        workspaceId: string;
        commercialName: string;
        contactEmail: string | null;
        phone: string | null;
        whatsapp: string | null;
        instagram: string | null;
        website: string | null;
        logoUrl: string | null;
      }
    | null = null;
  try {
    branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug: workspaceSlug },
      select: {
        workspaceId: true,
        commercialName: true,
        contactEmail: true,
        phone: true,
        whatsapp: true,
        instagram: true,
        website: true,
        logoUrl: true,
      },
    });
  } catch (error) {
    if (isPrismaDbUnavailableError(error)) {
      return (
        <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
          <main className="max-w-3xl mx-auto px-4 md:px-8 py-16">
            <section className="fo-card fo-alert-warning space-y-3 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Estamos reconectando</h1>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                La base de datos está temporalmente inaccesible. Reintentá en unos segundos.
              </p>
            </section>
          </main>
        </div>
      );
    }
    throw error;
  }

  if (!branding?.workspaceId) notFound();
  const serviceLeadForm = await prisma.serviceLeadForm.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: "xv",
      isActive: true,
    },
    select: { id: true, configJson: true },
  });

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <header className="border-b border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <span className="text-lg font-semibold tracking-tight truncate">{branding.commercialName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-[var(--fo-muted)]">
              <span className="block font-medium text-[var(--fo-text)]">{branding.commercialName}</span>
              {branding.contactEmail ? (
                <a href={`mailto:${branding.contactEmail}`} className="hover:text-[var(--fo-accent)]">
                  {branding.contactEmail}
                </a>
              ) : null}
            </div>
            {authUser ? (
              <form action={fotofficeLogoutAction}>
                <button
                  type="submit"
                  className="fo-btn fo-btn-secondary text-sm min-h-9 whitespace-nowrap"
                  aria-label="Cerrar sesión"
                >
                  Cerrar sesión
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <section className="fo-card border-[var(--fo-accent)]/30 bg-[var(--fo-bg-elevated)] space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
              Cobertura social
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-balance">
              Consultá tu cobertura de XV
            </h1>
            <p className="text-[var(--fo-muted)] leading-relaxed max-w-2xl">
              Dejanos tus datos y te enviamos una propuesta personalizada para cubrir tu evento de XV:
              opciones de foto, video, tiempos de entrega y presupuesto estimado.
            </p>
          </div>

          <PublicServiceLeadForm
            workspaceSlug={workspaceSlug}
            formId={serviceLeadForm?.id}
            formSlug="xv"
            configJson={serviceLeadForm?.configJson}
          />
        </section>

        <footer className="pt-10 pb-8 text-center text-sm text-[var(--fo-muted-soft)]">
          <p>{branding.commercialName} · Fotoffice</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {branding.website ? (
              <a href={branding.website} className="hover:text-[var(--fo-accent)]" target="_blank" rel="noreferrer">
                Web
              </a>
            ) : null}
            {branding.instagram ? (
              <a href={branding.instagram} className="hover:text-[var(--fo-accent)]" target="_blank" rel="noreferrer">
                Instagram
              </a>
            ) : null}
            {branding.whatsapp ? (
              <a href={branding.whatsapp} className="hover:text-[var(--fo-accent)]" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
            {branding.phone ? <span>{branding.phone}</span> : null}
          </div>
        </footer>
      </main>
    </div>
  );
}
