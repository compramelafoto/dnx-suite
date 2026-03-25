import { requireAuth } from "../../lib/auth";
import { getUserOrganizations } from "../../lib/fotorank/organizations";
import { resolveActiveOrganizationForUser } from "../../lib/fotorank/dashboard-org-context";
import { JuradosOrganizationSwitcher } from "../../components/jurados/JuradosOrganizationSwitcher";

export default async function JuradosLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const orgs = await getUserOrganizations(user.id);
  const resolved = await resolveActiveOrganizationForUser(user.id);
  const currentId = resolved.ok ? resolved.org.id : null;

  return (
    <div className="space-y-6">
      {orgs.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          No tenés organizaciones activas. Creá o uníte a una organización para usar Jurados.
        </div>
      ) : (
        <div className="rounded-lg border border-[#262626] bg-[#141414] px-4 py-3">
          {!resolved.ok && resolved.code !== "NO_ORGS" ? (
            <p className="mb-3 text-sm text-amber-200">{resolved.error}</p>
          ) : null}
          {orgs.length > 1 ? (
            <JuradosOrganizationSwitcher organizations={orgs} currentOrganizationId={currentId} />
          ) : (
            <p className="text-sm text-fr-muted">
              Organización: <span className="font-medium text-fr-primary">{orgs[0]!.name}</span>
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
