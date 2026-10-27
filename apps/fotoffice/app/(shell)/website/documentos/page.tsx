import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { appUrl } from "@/lib/app-url";
import { AVISO_TABLA_DOCUMENTOS_FALTANTE, MAX_BYTES_DOCUMENTO, MB } from "@/lib/website/documentos";
import { listarDocumentos } from "@/lib/website/documentos.server";
import { ListaDocumentos, SubirDocumento } from "@/components/website/documentos/documentos-cliente";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Documentos: PDF que el sitio comparte con un enlace (reemplaza «Propuestas» de
 * Prosite). Cualquiera con acceso al Sitio web ve la lista; subir, cambiar y borrar es de quien
 * puede editar el sitio. Spec: docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR D)
 */
export default async function WebsiteDocumentosPage() {
  const { workspace, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();
  const [documentos, branding, dominio] = await Promise.all([
    listarDocumentos(workspace.id),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } }),
    prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId: workspace.id }, select: { domain: true, status: true } }),
  ]);

  // El enlace que se comparte: el del dominio propio si está conectado; si no, el de FOTOFFICE.
  const base =
    dominio?.status === "CONNECTED"
      ? `https://${dominio.domain}/d/`
      : branding?.publicSlug
        ? `${appUrl()}/w/${branding.publicSlug}/d/`
        : null;

  return (
    <WebsiteShell workspaceId={workspace.id} status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <div className="space-y-5">
        <div className="fo-card space-y-2">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Documentos</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Subí un PDF (una propuesta, una lista de precios, un catálogo) y compartilo con un enlace de tu sitio. Quien lo abre lo ve en el
            navegador; acá ves cuántas veces se abrió. Hasta {MAX_BYTES_DOCUMENTO / MB} MB por archivo.
          </p>
        </div>
        {documentos === null ? (
          <p className="fo-card text-sm text-[var(--fo-danger)]" role="alert">
            {AVISO_TABLA_DOCUMENTOS_FALTANTE}
          </p>
        ) : (
          <>
            {canEdit ? <SubirDocumento slugsUsados={documentos.map((d) => d.slug)} base={base} /> : null}
            <ListaDocumentos
              canEdit={canEdit}
              base={base}
              documentos={documentos.map((d) => ({
                id: d.id,
                slug: d.slug,
                titulo: d.titulo,
                tamanoBytes: d.tamanoBytes,
                publicado: d.publicado,
                descargas: d.descargas,
                fecha: d.createdAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", year: "numeric" }),
              }))}
            />
          </>
        )}
      </div>
    </WebsiteShell>
  );
}
