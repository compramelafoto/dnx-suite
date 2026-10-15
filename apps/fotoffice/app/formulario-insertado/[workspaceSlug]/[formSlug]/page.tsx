import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicSite } from "@/lib/website/public-site";
import { websiteDesignCssVars, websiteFontsHref } from "@/lib/website/design-presets";
import { resolveCoverageBrand } from "@/lib/coverages/branding";
import { esFormularioInsertable } from "@/lib/service-leads/insertar";
import { AltoInsertado } from "@/components/consultas/alto-insertado";
import { PublicDynamicServiceLeadForm } from "@/app/w/[workspaceSlug]/public-dynamic-service-lead-form";
import { PublicServiceLeadForm } from "@/app/w/[workspaceSlug]/xv/public-service-lead-form";

type Props = { params: Promise<{ workspaceSlug: string; formSlug: string }> };

/**
 * El formulario de consulta SOLO, para insertar en cualquier web (WordPress, Wix, HTML propio).
 *
 * Nadie entra acá por esta dirección: el proxy reescribe `/w/<slug>/insertar[/<formulario>]` (y
 * `/insertar[/...]` en el dominio propio) a esta ruta, que vive fuera de `app/w/[workspaceSlug]/`
 * para no heredar el encabezado ni el pie del sitio. Ver lib/service-leads/insertar.ts.
 *
 * Es el MISMO formulario y la MISMA acción (`createServiceLead`) que en el sitio: alta de la
 * consulta como formulario web, campo trampa y freno por IP incluidos. El envío no necesita
 * cookies, y la acción se llama sobre el origen del marco (FOTOFFICE o el dominio propio), así
 * que el chequeo de Origin contra Host de Next pasa aunque la web de afuera sea otra.
 *
 * Los permisos de enmarcado (`frame-ancestors *`) y el `noindex` van en `next.config.ts`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function FormularioInsertadoPage({ params }: Props) {
  const { workspaceSlug, formSlug } = await params;
  if (!esFormularioInsertable(formSlug)) notFound();

  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  const form = await prisma.serviceLeadForm.findFirst({
    where: { workspaceId: site.workspaceId, slug: formSlug, isActive: true },
    select: { id: true, slug: true, title: true, configJson: true },
  });

  // La marca de la institución sobre los tokens del formulario (igual que la solicitud de
  // cobertura): el botón y el borde de los campos toman su color, y la letra la de su sitio.
  const marca = resolveCoverageBrand({ primaryColor: site.colors.primaryColor, accentColor: site.colors.accentColor });
  const estilo = {
    ...websiteDesignCssVars(site.designPresets),
    fontFamily: "var(--wsite-body-font)",
    ...(marca
      ? {
          accentColor: marca.accent,
          "--fo-accent": marca.accent,
          "--fo-accent-hover": marca.accent,
          "--fo-accent-muted": marca.soft,
        }
      : {}),
  } as CSSProperties;
  const fuentes = websiteFontsHref(site.designPresets);
  const titulo = form?.title?.trim() || "Formulario de consulta";

  return (
    <>
      {/* Fondo transparente: el marco toma el fondo de la web donde se inserta. */}
      <style>{`html,body{background:transparent!important;min-height:0!important}`}</style>
      {fuentes ? <link rel="stylesheet" href={fuentes} precedence="wsite-fonts" /> : null}
      <AltoInsertado>
        <main className="p-4" style={estilo} data-fotoffice-insertado={formSlug}>
          <h1 className="sr-only">{titulo}</h1>
          {formSlug === "xv" ? (
            <PublicServiceLeadForm
              workspaceSlug={workspaceSlug}
              formId={form?.id}
              formSlug="xv"
              configJson={form?.configJson}
              insertado
            />
          ) : form ? (
            <PublicDynamicServiceLeadForm workspaceSlug={workspaceSlug} form={form} insertado />
          ) : (
            <p className="text-sm text-[var(--fo-muted)]">Este formulario no está disponible.</p>
          )}
        </main>
      </AltoInsertado>
    </>
  );
}
