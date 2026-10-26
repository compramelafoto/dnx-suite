import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { WebsiteTopBar } from "@/components/website/website-top-bar";
import { WebsiteSubNav } from "@/components/website/website-sub-nav";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";
import { contarPendientes } from "@/lib/testimonios/repositorio";

/** Chrome compartido de las 5 pestañas del CMS (Editor/Diseño/Navegación/SEO/Historial). La
 * pestaña Vista previa NO lo usa — debe verse como el sitio, no como el panel de administración. */
export async function WebsiteShell({
  workspaceId,
  status,
  canEdit,
  draftUpdatedAt,
  children,
}: {
  /** Para el número de testimonios pendientes de la sub-navegación. */
  workspaceId: string;
  status: WebsiteChangeStatus;
  canEdit: boolean;
  draftUpdatedAt: string;
  children: ReactNode;
}) {
  // Es sólo un número de la sub-navegación: si falla, no rompe el panel del sitio.
  const pendientesTestimonios = await contarPendientes(workspaceId).catch((e: unknown) => {
    console.error("[sitio] no se pudo contar los testimonios pendientes", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return 0;
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sitio web"
        description="Construí y publicá la Home de tu sitio público con bloques visuales."
      />
      <WebsiteTopBar status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAt} />
      <WebsiteSubNav pendientesTestimonios={pendientesTestimonios} />
      <div>{children}</div>
    </div>
  );
}
