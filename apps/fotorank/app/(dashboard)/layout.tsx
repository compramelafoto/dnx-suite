import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardLayout } from "../components/DashboardLayout";
import { SuperAdminActAsBanner } from "../components/dashboard/SuperAdminActAsBanner";
import { canAccessFotorankOrganizerDashboard, requireAuth } from "../lib/auth";
import {
  resolveOrganizationsForDashboardUser,
  userIsFotorankSuperAdmin,
} from "../lib/fotorank/access/super-admin";
import { FOTORANK_ACTIVE_ORG_COOKIE } from "../lib/fotorank/dashboard-org-context";
import { getContestOrganizationProfileById } from "../lib/fotorank/organizationProfile";
import { bootstrapFotorankProfile } from "../lib/fotorank/profile";
import { getWorkspaceOptionsForUser } from "../lib/workspace-options";
import type { UserOrganization } from "../lib/fotorank/organizations";

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
}

function pickActiveOrg(
  organizations: UserOrganization[],
  preferredIds: Array<string | null | undefined>,
): { org: UserOrganization | null; error: string | null } {
  for (const id of preferredIds) {
    if (!id) continue;
    const match = organizations.find((o) => o.id === id);
    if (match) return { org: match, error: null };
  }
  if (organizations.length === 1) return { org: organizations[0]!, error: null };
  if (organizations.length === 0) {
    return { org: null, error: "No hay organizaciones disponibles." };
  }
  return {
    org: null,
    error: "Elegí una organización en el selector (o usá «Actuar como…» desde Super Admin).",
  };
}

export default async function DashboardLayoutWrapper({
  children,
}: DashboardLayoutWrapperProps) {
  const user = await requireAuth();
  if (!(await canAccessFotorankOrganizerDashboard(user))) {
    redirect("/mi-actividad");
  }
  await bootstrapFotorankProfile(user);

  const { organizations, isSuperAdmin, actAsOrganizationId } =
    await resolveOrganizationsForDashboardUser(user);

  if (organizations.length === 0 && !isSuperAdmin) {
    redirect("/onboarding");
  }
  if (organizations.length === 0 && isSuperAdmin) {
    redirect("/super-admin");
  }

  const jar = await cookies();
  const cookieOrgId = jar.get(FOTORANK_ACTIVE_ORG_COOKIE)?.value?.trim() ?? null;

  const preferred = isSuperAdmin
    ? [actAsOrganizationId, cookieOrgId, organizations[0]?.id]
    : [cookieOrgId];

  const { org: activeOrg, error: activeOrgError } = pickActiveOrg(organizations, preferred);

  // Organizador regular con 1 sola org: pickActiveOrg ya la elige.
  // Con N orgs y sin cookie: error NEEDS_CHOICE (selector).
  let currentOrganizationId = activeOrg?.id ?? null;
  let error = activeOrgError;
  if (!isSuperAdmin && !currentOrganizationId && organizations.length === 1) {
    currentOrganizationId = organizations[0]!.id;
    error = null;
  }
  if (isSuperAdmin && currentOrganizationId) {
    error = null;
  }

  const organizationProfile = currentOrganizationId
    ? await getContestOrganizationProfileById(currentOrganizationId)
    : null;

  const suiteWorkspaces = await getWorkspaceOptionsForUser(user.id);
  const actAsOrgName =
    isSuperAdmin && actAsOrganizationId
      ? organizations.find((o) => o.id === actAsOrganizationId)?.name ?? null
      : null;

  return (
    <DashboardLayout
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
      organizationProfile={organizationProfile}
      activeOrgError={error}
      suiteWorkspaces={suiteWorkspaces}
      activeSuiteWorkspaceId={user.currentWorkspaceId}
      userDisplayName={user.name ?? ""}
      userEmail={user.email}
    >
      {userIsFotorankSuperAdmin(user) && actAsOrgName ? (
        <SuperAdminActAsBanner organizationName={actAsOrgName} />
      ) : null}
      {children}
    </DashboardLayout>
  );
}
