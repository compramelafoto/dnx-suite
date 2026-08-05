import { stopActAsOrganizerAction } from "../../actions/super-admin-context";

export function SuperAdminActAsBanner({ organizationName }: { organizationName: string }) {
  return (
    <div
      className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-6 py-4"
      data-testid="super-admin-act-as-banner"
    >
      <p className="text-sm leading-relaxed text-fr-primary">
        Modo <span className="font-semibold text-gold">Actuar como organizador</span>:{" "}
        {organizationName}. Los permisos reales no se modifican.
      </p>
      <form action={stopActAsOrganizerAction}>
        <button type="submit" className="fr-btn fr-btn-secondary px-5 py-3 text-sm">
          Volver a Super Admin
        </button>
      </form>
    </div>
  );
}
