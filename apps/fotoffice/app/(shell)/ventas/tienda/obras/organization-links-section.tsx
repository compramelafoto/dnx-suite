import { canLinkFromWorkspace, listLinkableOrganizations, listLinkedOrganizations } from "@/lib/store/artworks/links";
import { LinkedOrganizationsList } from "./linked-organizations-list";
import { LinkOrganizationForm } from "./link-organization-form";

function fecha(d: Date) {
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sección "Organizaciones de FotoRank vinculadas": la lista y cómo vincular otra. */
export async function OrganizationLinksSection({ userId, workspaceId }: { userId: number; workspaceId: string }) {
  const [vinculadas, vinculables, adminDelWorkspace] = await Promise.all([
    listLinkedOrganizations(workspaceId),
    listLinkableOrganizations(userId, workspaceId),
    canLinkFromWorkspace(userId, workspaceId),
  ]);

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Organizaciones de FotoRank vinculadas</h2>
        <p className="fo-helper">
          Sólo podés vender obras de concursos de las organizaciones vinculadas acá. Si quitás un vínculo, las obras de
          esa organización dejan de mostrarse y venderse en tu tienda (los permisos de los autores no se borran).
        </p>
      </div>

      <LinkedOrganizationsList
        organizations={vinculadas.map((o) => ({
          organizationId: o.organizationId,
          name: o.name,
          slug: o.slug,
          linkedAtText: fecha(o.linkedAt),
          linkedByName: o.linkedByName,
        }))}
      />

      <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
        <h3 className="text-sm font-semibold">Vincular una organización de FotoRank</h3>
        {!adminDelWorkspace ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Sólo el dueño o un administrador de este espacio en FOTOFFICE puede vincular organizaciones.
          </p>
        ) : vinculables.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            No hay organizaciones para vincular. Para vincular una, tenés que ser dueño o administrador de esa organización
            en FotoRank, entrando con el mismo email que usás en FOTOFFICE.
          </p>
        ) : (
          <LinkOrganizationForm organizations={vinculables} />
        )}
      </div>
    </section>
  );
}
