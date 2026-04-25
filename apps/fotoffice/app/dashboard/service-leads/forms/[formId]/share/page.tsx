import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { ShareDetailsClient } from "./share-details-client";

type Props = { params: Promise<{ formId: string }> };

export default async function ShareServiceLeadFormPage({ params }: Props) {
  const { workspace } = await requireActiveWorkspace();
  const { formId } = await params;

  if (!workspace) notFound();

  const form = await prisma.serviceLeadForm.findFirst({
    where: {
      id: formId,
      workspaceId: workspace.id,
    },
  });

  if (!form) notFound();

  const publicUrl = form.slug === "general" ? "/w/dnx-estudio" : `/w/dnx-estudio/${form.slug}`;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Compartir formulario"
        description="Usá estos enlaces para compartir o insertar este formulario."
      />

      <ShareDetailsClient
        formName={form.name}
        formSlug={form.slug}
        formMode={form.formMode}
        publicUrl={publicUrl}
      />
    </div>
  );
}
