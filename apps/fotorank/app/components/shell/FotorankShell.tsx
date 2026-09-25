"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { landingSignOutAction } from "../../actions/landing-session";
import { Header } from "../Header";
import { menuLinksFromSections, type ShellSection } from "./shell-nav";
import { rolActivo, type MenuDeLaCuenta } from "./menuDeLaCuenta";
import { RotuloSuperAdmin, SelectorDeRol } from "./SelectorDeRol";

/**
 * El armazón del panel, uno solo para toda la cuenta.
 *
 * Hasta el 2026-09-21 cada área resolvía su propio marco: el organizador tenía barra
 * lateral, el participante un encabezado con dos enlaces de texto, el jurado nada —cada una
 * de sus pantallas dibujaba su propio encabezado— y el super admin otro más. Cuatro áreas
 * del mismo producto que no se parecían entre sí.
 *
 * Acá viven el encabezado, la barra lateral, sus estados (abierta, minimizada, móvil) y el
 * pie con la cuenta. Un área nueva sólo aporta **sus secciones de menú** y, si la tiene, su
 * identidad — la organización activa, en el caso del organizador.
 */

// eslint-disable-next-line react/prop-types -- el tipo viene del design system compartido
const SidebarLink: SidebarLinkComponent = ({ href, className, style, children, onClick, ...rest }) => (
  <Link
    href={href}
    className={className}
    style={style}
    onClick={onClick}
    {...rest}
  >
    {children}
  </Link>
);

export interface FotorankShellProps {
  children: React.ReactNode;
  /**
   * El menú de la cuenta: los roles para elegir (fotógrafo, jurado,
   * organizador) o el menú fijo del super admin. La barra lateral y el menú
   * del encabezado salen de acá.
   */
  menu: MenuDeLaCuenta;
  /** Encabezado propio de la barra: hoy sólo el organizador tiene uno (su organización). */
  identity?: React.ReactNode;
  userDisplayName: string;
  userEmail: string;
  /** A dónde lleva el engranaje del pie. Sin esto, el pie no lo muestra. */
  settingsHref?: string;
  /** Roles de quien mira, para esconder lo que no le corresponde. */
  roles?: string[];
  /**
   * Cómo se cierra la sesión de esta área. El jurado tiene su propia sesión, con su propia
   * acción: si no se pudiera cambiar, el botón de salir lo dejaría adentro.
   */
  logoutAction?: () => void | Promise<void>;
}

export function FotorankShell({
  children,
  menu,
  identity,
  userDisplayName,
  userEmail,
  settingsHref,
  roles,
  logoutAction = landingSignOutAction,
}: FotorankShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(true);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const openDesktopSidebar = useCallback(
    () => setDesktopSidebarExpanded(true),
    [],
  );
  const closeDesktopSidebar = useCallback(
    () => setDesktopSidebarExpanded(false),
    [],
  );

  const handleSettings = useCallback(() => {
    if (!settingsHref) return;
    closeMobileSidebar();
    router.push(settingsHref);
  }, [closeMobileSidebar, router, settingsHref]);

  const handleLogout = useCallback(() => {
    startLogoutTransition(() => {
      void logoutAction();
    });
  }, [logoutAction]);

  // El rol lo decide la pantalla: ver `rolDeLaRuta`.
  const activo = useMemo(
    () => (menu.tipo === "roles" ? rolActivo(menu.roles, pathname) : null),
    [menu, pathname],
  );
  const sections = useMemo<ShellSection[]>(
    () => (menu.tipo === "roles" ? (activo?.sections ?? []) : menu.sections),
    [menu, activo],
  );
  const homeHref = menu.tipo === "roles" ? (activo?.inicio ?? "/") : "/super-admin";

  const rolesEfectivos = useMemo(() => roles ?? ["admin"], [roles]);
  const visibles = useMemo(
    () =>
      filterSidebarByRoles(sections as SidebarSectionConfig[], rolesEfectivos),
    [sections, rolesEfectivos],
  );

  // El menú del encabezado se deriva de lo que la barra muestra de verdad: si un ítem está
  // escondido por rol, tampoco aparece en el menú a pantalla completa.
  const menuLinks = useMemo(
    () => menuLinksFromSections(visibles as ShellSection[]),
    [visibles],
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
            menuLinks={menuLinks}
            homeHref={homeHref}
          />
        }
        mobileSidebarOpen={mobileSidebarOpen}
        onMobileSidebarClose={closeMobileSidebar}
        desktopSidebarExpanded={desktopSidebarExpanded}
        sidebarViewportTop="6.5rem"
        sidebar={
          <div className="h-full min-h-0">
            <Sidebar>
              {menu.tipo === "roles" ? (
                <SelectorDeRol
                  roles={menu.roles}
                  activo={activo?.rol ?? null}
                  onNavigate={closeMobileSidebar}
                />
              ) : (
                <RotuloSuperAdmin />
              )}
              {identity}
              <SidebarBody>
                <SidebarNavFromConfig
                  sections={visibles}
                  activePath={pathname}
                  LinkComponent={SidebarLink}
                  onNavigate={closeMobileSidebar}
                />
              </SidebarBody>
              <SidebarFooter
                userName={userDisplayName}
                userEmail={userEmail}
                onSettings={settingsHref ? handleSettings : undefined}
                onLogout={handleLogout}
                logoutLabel={
                  isLogoutPending ? "Cerrando sesión…" : "Cerrar sesión"
                }
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
