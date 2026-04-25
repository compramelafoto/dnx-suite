import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PublicDynamicServiceLeadForm } from "./public-dynamic-service-lead-form";

type Props = { params: Promise<{ workspaceSlug: string }> };

export default async function PublicGeneralLeadPage({ params }: Props) {
  const { workspaceSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: {
      workspaceId: true,
      commercialName: true,
    },
  });

  if (!branding) notFound();

  const form = await prisma.serviceLeadForm.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: "general",
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      configJson: true,
    },
  });

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <section className="fo-card border-[var(--fo-accent)]/30 bg-[var(--fo-bg-elevated)] space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
              {branding.commercialName}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-balance">
              {form?.title ?? "Solicitá tu presupuesto"}
            </h1>
            <p className="text-[var(--fo-muted)] leading-relaxed max-w-2xl">
              {form?.description ??
                "Elegí el tipo de servicio que necesitás y completá tus datos para recibir una propuesta."}
            </p>
          </div>

          {!form ? (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">No hay formulario disponible.</p>
          ) : (
            <PublicDynamicServiceLeadForm workspaceSlug={workspaceSlug} form={form} />
          )}
        </section>
      </main>
    </div>
  );
}
