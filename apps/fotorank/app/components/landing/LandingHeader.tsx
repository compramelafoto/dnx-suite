"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { FullscreenMenu, getLandingMenuLinks } from "./FullscreenMenu";
import { LoginChoiceModal } from "./LoginChoiceModal";
import { landingSignOutAction } from "../../actions/landing-session";
import {
  AppHeaderFlexZones,
  HeaderActions,
  HeaderContainer,
  HeaderMenuToggle,
  dashboardWordmarkLogoClassName,
} from "../app-header";

/** Iconos circulares dorados (outline): panel, sesión — alineado a `appShellHeader.circularAction` y `PublicMarketingHeader`. */
const landingHeaderIconBtnClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/10 hover:text-[#e5c04a] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold";

export type LandingHeaderProps = {
  hasAdminSession: boolean;
  hasJudgeSession: boolean;
};

export function LandingHeader({ hasAdminSession, hasJudgeSession }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const hasAnySession = hasAdminSession || hasJudgeSession;
  /** Panel por tipo de sesión: organizador → app interna; solo jurado → panel jurado. */
  const panelHref = hasAdminSession ? "/dashboard" : "/jurado/panel";

  const openLoginModal = () => setLoginModalOpen(true);

  const handleSessionIconClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) {
      e.preventDefault();
      window.location.assign("/login");
      return;
    }
    openLoginModal();
  };

  return (
    <>
      <HeaderContainer variant="landing" relaxedHeight>
        <AppHeaderFlexZones
          alignLeftWithSidebarBand
          rowClassName="min-h-[4.5rem] items-center md:min-h-[5.5rem] lg:min-h-[6rem]"
          left={
            <Link href="/" className="flex min-w-0 items-center justify-center" aria-label="FotoRank">
              <Image
                src="/fotorank-logo.png"
                alt="FotoRank"
                width={288}
                height={96}
                className={dashboardWordmarkLogoClassName}
                loading="eager"
                priority
              />
            </Link>
          }
          center={null}
          right={
            <HeaderActions>
              {hasAnySession ? (
                <>
                  <Link
                    href={panelHref}
                    className={landingHeaderIconBtnClass}
                    aria-label="Ir al panel"
                    title="Ir al panel"
                  >
                    <LayoutDashboard className="size-6" strokeWidth={2} aria-hidden />
                  </Link>
                  <form action={landingSignOutAction}>
                    <button type="submit" className={landingHeaderIconBtnClass} aria-label="Cerrar sesión">
                      <LogOut className="size-6" strokeWidth={2} aria-hidden />
                    </button>
                  </form>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSessionIconClick}
                  className={landingHeaderIconBtnClass}
                  aria-label="Iniciar sesión"
                  title="Iniciar sesión (Mayús+clic: acceso administrador)"
                >
                  <LogIn className="size-6" strokeWidth={2} aria-hidden />
                </button>
              )}
              <HeaderMenuToggle onClick={() => setMenuOpen(true)} />
            </HeaderActions>
          }
        />
      </HeaderContainer>

      <LoginChoiceModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />

      <FullscreenMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={getLandingMenuLinks(hasAnySession)}
        onRequestLoginModal={hasAnySession ? undefined : openLoginModal}
      />
    </>
  );
}
