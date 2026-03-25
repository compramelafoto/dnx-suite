import { redirect } from "next/navigation";
import { DashboardLayout } from "../components/DashboardLayout";
import { requireAuth } from "../lib/auth";
import { bootstrapFotorankProfile } from "../lib/fotorank/profile";
import { getUserOrganizations } from "../lib/fotorank/organizations";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { getContestOrganizationProfileById } from "../lib/fotorank/organizationProfile";

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
}

export default async function DashboardLayoutWrapper({
  children,
}: DashboardLayoutWrapperProps) {
  const user = await requireAuth();
  await bootstrapFotorankProfile(user);

  const orgs = await getUserOrganizations(user.id);
  if (orgs.length === 0) redirect("/onboarding");

  const resolved = await resolveActiveOrganizationForUser(user.id);
  const organizationProfile =
    resolved.ok ? await getContestOrganizationProfileById(resolved.org.id) : null;

  return (
    <DashboardLayout
      organizations={orgs}
      currentOrganizationId={resolved.ok ? resolved.org.id : null}
      organizationProfile={organizationProfile}
      activeOrgError={resolved.ok ? null : resolved.error}
      userDisplayName={user.name ?? ""}
      userEmail={user.email}
    >
      {children}
    </DashboardLayout>
  );
}
