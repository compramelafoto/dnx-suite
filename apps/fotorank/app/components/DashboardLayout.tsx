"use client";

import { useMemo, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { landingSignOutAction } from "../actions/landing-session";
import {
  AppLayout,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarNavFromConfig,
  filterSidebarByRoles,
  type SidebarSectionConfig,
  type SidebarLinkComponent,
  DesignSystemProvider,
  themeFotorank,
} from "@repo/design-system";
import type { ContestOrganizationProfileDTO } from "../lib/fotorank/organizationProfile";
import { Header } from "./Header";
import { SidebarOrgIdentityHeader } from "./dashboard/SidebarOrgIdentityHeader";

interface DashboardLayoutProps {
  children: React.ReactNode;
  organizations: { id: string; name: string; slug: string }[];
  currentOrganizationId: string | null;
  organizationProfile: ContestOrganizationProfileDTO | null;
  activeOrgError: string | null;
  userDisplayName: string;
  userEmail: string;
}

const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    title: "Concursos",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "Concursos", href: "/concursos", icon: "camera" },
      { label: "Categorías", href: "/categorias", icon: "album" },
      { label: "Participaciones", href: "/participaciones", icon: "gallery" },
    ],
  },
  {
    title: "Gestión",
    items: [
      { label: "Jurados", href: "/jurados", icon: "user", roles: ["admin", "manager"] },
      { label: "Invitaciones", href: "/jurados/invitaciones", icon: "email", roles: ["admin", "manager"] },
      { label: "Asignaciones", href: "/jurados/asignaciones", icon: "plus", roles: ["admin", "manager"] },
      { label: "Auditoría", href: "/jurados/auditoria", icon: "search", roles: ["admin", "manager"] },
      { label: "Ranking", href: "/ranking", icon: "sort" },
      { label: "Diplomas", href: "/diplomas", icon: "invoice" },
    ],
  },
  {
    title: "Configuración",
    items: [{ label: "Institucional", href: "/dashboard/settings", icon: "settings" }],
  },
];

const SidebarLink: SidebarLinkComponent = ({ href, className, style, children, onClick, ...rest }) => (
  <Link href={href} className={className} style={style} onClick={onClick} {...rest}>
    {children}
  </Link>
);

export function DashboardLayout({
  children,
  organizations,
  currentOrganizationId,
  organizationProfile,
  activeOrgError,
  userDisplayName,
  userEmail,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(true);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const openDesktopSidebar = useCallback(() => setDesktopSidebarExpanded(true), []);
  const closeDesktopSidebar = useCallback(() => setDesktopSidebarExpanded(false), []);

  const handleSidebarSettings = useCallback(() => {
    closeMobileSidebar();
    router.push("/dashboard/settings");
  }, [closeMobileSidebar, router]);

  const handleSidebarLogout = useCallback(() => {
    startLogoutTransition(() => {
      void landingSignOutAction();
    });
  }, []);

  const userRoles = useMemo(() => ["admin"], []);
  const sidebarSections = useMemo(
    () => filterSidebarByRoles(SIDEBAR_SECTIONS, userRoles),
    [userRoles],
  );

  return (
    <DesignSystemProvider theme={themeFotorank.brand} mode="dark">
      <AppLayout
        header={
          <Header
            mobileSidebarOpen={mobileSidebarOpen}
            desktopSidebarExpanded={desktopSidebarExpanded}
            onMobileSidebarOpen={openMobileSidebar}
            onMobileSidebarClose={closeMobileSidebar}
            onDesktopSidebarOpen={openDesktopSidebar}
            onDesktopSidebarClose={closeDesktopSidebar}
          />
        }
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarClose={closeMobileSidebar}
        desktopSidebarExpanded={desktopSidebarExpanded}
        sidebarViewportTop="6.5rem"
        sidebar={
          <div className="h-full min-h-0">
            <Sidebar>
              <SidebarOrgIdentityHeader
                organizationProfile={organizationProfile}
                organizations={organizations}
                currentOrganizationId={currentOrganizationId}
                activeOrgError={activeOrgError}
              />

              <SidebarBody>
                <SidebarNavFromConfig
                  sections={sidebarSections}
                  activePath={pathname}
                  LinkComponent={SidebarLink}
                  onNavigate={closeMobileSidebar}
                />
              </SidebarBody>

              <SidebarFooter
                userName={userDisplayName}
                userEmail={userEmail}
                onSettings={handleSidebarSettings}
                onLogout={handleSidebarLogout}
                logoutLabel={isLogoutPending ? "Cerrando sesión…" : "Cerrar sesión"}
              />
            </Sidebar>
          </div>
        }
      >
        <main style={{ minWidth: 0 }}>
          <div className="fr-dashboard-main flex-1">{children}</div>
        </main>
      </AppLayout>
    </DesignSystemProvider>
  );
}
