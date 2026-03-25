import Link from "next/link";
import type { ContestOrganizationProfileDTO } from "../../lib/fotorank/organizationProfile";
import { JuradosOrganizationSwitcher } from "../jurados/JuradosOrganizationSwitcher";

type OrgOption = { id: string; name: string; slug: string };

export function SidebarOrgIdentityHeader({
  organizationProfile,
  organizations,
  currentOrganizationId,
  activeOrgError,
}: {
  organizationProfile: ContestOrganizationProfileDTO | null;
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  activeOrgError: string | null;
}) {
  return (
    <header className="border-b border-fr-border px-4 pb-4 pt-4">
      {activeOrgError ? (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs leading-snug text-amber-100">
          {activeOrgError}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-2 text-center">
        {organizationProfile?.logoUrl ? (
          <Link
            href="/dashboard/settings"
            className="relative block h-14 w-full max-w-[200px] transition-opacity hover:opacity-90"
            aria-label="Perfil institucional de la organización"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URLs externas arbitrarias */}
            <img
              src={organizationProfile.logoUrl}
              alt=""
              className="mx-auto h-14 w-auto max-w-full object-contain object-center"
            />
          </Link>
        ) : organizationProfile ? (
          <Link
            href="/dashboard/settings"
            className="px-1 text-center text-base font-semibold leading-tight text-fr-primary hover:text-gold"
          >
            {organizationProfile.name}
          </Link>
        ) : (
          <span className="text-sm text-fr-muted">Configurá tu organización</span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-fr-muted-soft">
          Plataforma FotoRank
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {organizations.length > 1 ? (
          <JuradosOrganizationSwitcher
            organizations={organizations}
            currentOrganizationId={currentOrganizationId}
            label="Organización activa"
          />
        ) : null}
        {organizationProfile ? (
          <Link
            href="/dashboard/settings"
            className="block text-center text-xs font-medium text-gold hover:text-gold-hover hover:underline"
          >
            Perfil institucional
          </Link>
        ) : null}
      </div>
    </header>
  );
}
