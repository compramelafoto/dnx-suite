"use client";

import { FotorankShell } from "./shell/FotorankShell";
import { SECCIONES_ORGANIZADOR } from "./shell/sections";
import { SidebarOrgIdentityHeader } from "./dashboard/SidebarOrgIdentityHeader";
import type { ContestOrganizationProfileDTO } from "../lib/fotorank/organizationProfile";
import type { WorkspaceOption } from "../lib/workspace-options";

interface DashboardLayoutProps {
  children: React.ReactNode;
  organizations: { id: string; name: string; slug: string }[];
  currentOrganizationId: string | null;
  organizationProfile: ContestOrganizationProfileDTO | null;
  activeOrgError: string | null;
  suiteWorkspaces: WorkspaceOption[];
  activeSuiteWorkspaceId: string | null;
  userDisplayName: string;
  userEmail: string;
}

/**
 * El panel del organizador.
 *
 * Desde el 2026-09-21 el marco —encabezado, barra lateral, sus estados y el pie con la
 * cuenta— vive en `FotorankShell`, compartido con el participante y el jurado. Acá queda
 * sólo lo propio del organizador: su menú y la organización activa arriba de la barra.
 */
export function DashboardLayout({
  children,
  organizations,
  currentOrganizationId,
  organizationProfile,
  activeOrgError,
  suiteWorkspaces,
  activeSuiteWorkspaceId,
  userDisplayName,
  userEmail,
}: DashboardLayoutProps) {
  return (
    <FotorankShell
      sections={SECCIONES_ORGANIZADOR}
      identity={
        <SidebarOrgIdentityHeader
          organizationProfile={organizationProfile}
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
          activeOrgError={activeOrgError}
          suiteWorkspaces={suiteWorkspaces}
          activeSuiteWorkspaceId={activeSuiteWorkspaceId}
        />
      }
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      settingsHref="/dashboard/settings"
      homeHref="/dashboard"
    >
      {children}
    </FotorankShell>
  );
}
