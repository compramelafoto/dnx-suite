import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireServiceLeadsContext } from "@/lib/workspace";
import { rutaPublicaFormulario } from "@/lib/service-leads/ruta-publica";
import { ShareDetailsClient } from "./share-details-client";

type Props = { params: Promise<{ formId: string }> };

export default async function ShareServiceLeadFormPage({ params }: Props) {
  const { workspace } = await requireServiceLeadsContext();
  const { formId } = await params;

  const form = await prisma.serviceLeadForm.findFirst({
    where: {
      id: formId,
      workspaceId: workspace.id,
    },
  });

  if (!form) notFound();

  // El enlace público sale de la dirección real del workspace, nunca de un valor fijo.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  const publicUrl = rutaPublicaFormulario(branding?.publicSlug, form.slug);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Compartir formulario"
        description="Usá estos enlaces para compartir o insertar este formulario."
      />

      {publicUrl ? (
        <ShareDetailsClient
          formName={form.name}
          formSlug={form.slug}
          formMode={form.formMode}
          publicUrl={publicUrl}
        />
      ) : (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Este workspace todavía no tiene una dirección pública: configurala para poder compartir el formulario.
          </p>
        </div>
      )}
    </div>
  );
}
