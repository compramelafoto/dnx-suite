import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";

/** Solo lectura por esta etapa — "Restaurar versión" queda para una etapa posterior (ver
 * pedido). Nunca se muestran IDs técnicos, solo número de versión, fecha y quién publicó. */
export default async function WebsiteHistoryPage() {
  const { draft, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  const versions = await prisma.fotofficeWorkspaceWebsiteVersion.findMany({
    where: { websiteId: draft.id },
    orderBy: { versionNumber: "desc" },
    select: {
      versionNumber: true,
      publishedAt: true,
      publishedBy: { select: { name: true, email: true } },
    },
  });

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      {versions.length === 0 ? (
        <div className="fo-card text-center py-12">
          <p className="text-sm text-[var(--fo-muted)]">Todavía no publicaste ninguna versión de tu sitio.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => (
            <li key={v.versionNumber} className="fo-card flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--fo-text)]">Versión {v.versionNumber}</p>
                <p className="text-xs text-[var(--fo-muted)] mt-0.5">
                  Publicada el {new Date(v.publishedAt).toLocaleString("es-AR")}
                  {v.publishedBy ? ` · Por ${v.publishedBy.name ?? v.publishedBy.email}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WebsiteShell>
  );
}
