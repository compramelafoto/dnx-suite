"use client";

import { FotorankShell } from "./shell/FotorankShell";
import type { MenuDeLaCuenta } from "./shell/menuDeLaCuenta";
import { SidebarOrgIdentityHeader } from "./dashboard/SidebarOrgIdentityHeader";
import type { ContestOrganizationProfileDTO } from "../lib/fotorank/organizationProfile";
import type { WorkspaceOption } from "../lib/workspace-options";

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** El menú de la cuenta: el mismo que ve la persona en cualquier otra área. */
  menu: MenuDeLaCuenta;
  organizations: { id: string; name: string; slug: string }[];
  currentOrganizationId: string | null;
  organizationProfile: ContestOrganizationProfileDTO | null;
  activeOrgError: string | null;
  suiteWorkspaces: WorkspaceOption[];
  activeSuiteWorkspaceId: string | null;
  userDisplayName: string;
  userEmail: string;
  esSuperAdmin: boolean;
}

/**
 * El panel del organizador.
 *
 * El marco y el menú son los de toda la cuenta (`FotorankShell` y
 * `menuDeLaCuenta`). Lo único propio del organizador es la organización activa,
 * arriba de la barra: es el contexto de todas estas pantallas.
 */
export function DashboardLayout({
  children,
  menu,
  organizations,
  currentOrganizationId,
  organizationProfile,
  activeOrgError,
  suiteWorkspaces,
  activeSuiteWorkspaceId,
  userDisplayName,
  userEmail,
  esSuperAdmin,
}: DashboardLayoutProps) {
  return (
    <FotorankShell
      menu={menu}
      identity={
        <SidebarOrgIdentityHeader
          organizationProfile={organizationProfile}
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
          activeOrgError={activeOrgError}
          suiteWorkspaces={suiteWorkspaces}
          activeSuiteWorkspaceId={activeSuiteWorkspaceId}
          esSuperAdmin={esSuperAdmin}
        />
      }
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      settingsHref="/dashboard/settings"
    >
      {children}
    </FotorankShell>
  );
}
