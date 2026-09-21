import { requireAuth } from "../../lib/auth";
import { getUserOrganizations } from "../../lib/fotorank/organizations";
import { resolveActiveOrganizationForUser } from "../../lib/fotorank/dashboard-org-context";
import { JuradosOrganizationSwitcher } from "../../components/jurados/JuradosOrganizationSwitcher";
import { ContextOrgChip } from "../../components/dashboard-patterns";

export default async function JuradosLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const orgs = await getUserOrganizations(user.id);
  const resolved = await resolveActiveOrganizationForUser(user.id);
  const currentId = resolved.ok ? resolved.org.id : null;
  const currentOrg = currentId ? orgs.find((o) => o.id === currentId) : orgs[0];

  // El aviso mira de qué organizaciones sos MIEMBRO; la pantalla usa la que
  // quedó resuelta. Un Super Admin no es miembro de ninguna pero las ve todas,
  // así que sin esto la pantalla decía "no tenés organizaciones" arriba de una
  // lista de jurados de una organización.
  const sinOrganizacion = orgs.length === 0 && !resolved.ok;

  return (
    <div className="space-y-8">
      {sinOrganizacion ? (
        <div className="fr-dashboard-page-shell rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          No tenés organizaciones activas. Creá o uníte a una organización para usar Jurados.
        </div>
      ) : (
        <div className="fr-dashboard-page-shell">
          {!resolved.ok && resolved.code !== "NO_ORGS" ? (
            <p className="mb-4 text-sm text-amber-200">{resolved.error}</p>
          ) : null}
          {orgs.length > 1 ? (
            <ContextOrgChip label="Organización" value={currentOrg?.name ?? "…"}>
              <JuradosOrganizationSwitcher
                organizations={orgs}
                currentOrganizationId={currentId}
                hideLabel
                className="w-full sm:max-w-xs"
              />
            </ContextOrgChip>
          ) : orgs.length === 1 ? (
            <ContextOrgChip label="Organización" value={orgs[0]!.name} />
          ) : resolved.ok ? (
            <ContextOrgChip label="Organización" value={resolved.org.name} />
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
