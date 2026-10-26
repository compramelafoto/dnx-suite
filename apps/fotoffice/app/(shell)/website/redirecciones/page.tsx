import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { listarRedirecciones } from "@/lib/website/redirecciones";
import { PanelRedirecciones } from "@/components/website/redirecciones/panel-redirecciones";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Redirecciones: las direcciones viejas que llevan a las nuevas. Las del importador de
 * Alboom aparecen marcadas. Spec: docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md (PR 4)
 */
export default async function WebsiteRedireccionesPage() {
  const { workspace, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();
  const filas = await listarRedirecciones(workspace.id);

  return (
    <WebsiteShell workspaceId={workspace.id} status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <PanelRedirecciones
        canEdit={canEdit}
        faltaTabla={filas === null}
        redirecciones={(filas ?? []).map((r) => ({ id: r.id, desde: r.desde, hacia: r.hacia, codigo: r.codigo, origen: r.origen }))}
      />
    </WebsiteShell>
  );
}
