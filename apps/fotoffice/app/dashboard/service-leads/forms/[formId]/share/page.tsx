import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireServiceLeadsContext } from "@/lib/workspace";
import { appUrl } from "@/lib/app-url";
import {
  baseDelSitio,
  codigoMarcoConAltoAutomatico,
  codigoMarcoSimple,
  esFormularioInsertable,
  urlInsertada,
  urlPublicaFormulario,
  urlScriptInsertar,
} from "@/lib/service-leads/insertar";
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

  // El enlace público sale de la dirección real del workspace, nunca de un valor fijo: su dominio
  // propio si lo tiene conectado, si no `<FOTOFFICE>/w/<slug>`. Siempre absoluto, porque se pega
  // en otra web.
  const [branding, dominio] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { publicSlug: true },
    }),
    prisma.fotofficeWorkspaceDomain.findUnique({
      where: { workspaceId: workspace.id },
      select: { domain: true, status: true },
    }),
  ]);
  const base = baseDelSitio({
    customDomain: dominio?.status === "CONNECTED" ? dominio.domain : null,
    appOrigin: appUrl(),
    slug: branding?.publicSlug ?? null,
  });
  const publicUrl = base ? urlPublicaFormulario(base, form.slug) : null;
  const titulo = form.title?.trim() || form.name;
  const insertar =
    base && esFormularioInsertable(form.slug)
      ? (() => {
          const url = urlInsertada(base, form.slug);
          return {
            url,
            simple: codigoMarcoSimple({ url, titulo }),
            conAltoAutomatico: codigoMarcoConAltoAutomatico({ url, titulo, scriptUrl: urlScriptInsertar(base) }),
          };
        })()
      : null;

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
          insertar={insertar}
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
