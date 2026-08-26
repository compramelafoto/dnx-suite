import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { WebsiteTopBar } from "@/components/website/website-top-bar";
import { WebsiteSubNav } from "@/components/website/website-sub-nav";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";

/** Chrome compartido de las 5 pestañas del CMS (Editor/Diseño/Navegación/SEO/Historial). La
 * pestaña Vista previa NO lo usa — debe verse como el sitio, no como el panel de administración. */
export function WebsiteShell({
  status,
  canEdit,
  draftUpdatedAt,
  children,
}: {
  status: WebsiteChangeStatus;
  canEdit: boolean;
  draftUpdatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sitio web"
        description="Construí y publicá la Home de tu sitio público con bloques visuales."
      />
      <WebsiteTopBar status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAt} />
      <WebsiteSubNav />
      <div>{children}</div>
    </div>
  );
}
