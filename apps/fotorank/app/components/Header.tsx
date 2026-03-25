"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FullscreenMenu } from "./landing/FullscreenMenu";
import {
  AppHeaderFlexZones,
  HeaderActions,
  HeaderContainer,
  HeaderMenuToggle,
  dashboardWordmarkLogoClassName,
} from "./app-header";

function IconHamburger() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

const sidebarControlBtnClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-fr-muted transition-colors duration-300 ease-out hover:bg-fr-card hover:text-fr-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-gold active:scale-95";

export interface HeaderProps {
  mobileSidebarOpen: boolean;
  desktopSidebarExpanded: boolean;
  onMobileSidebarOpen: () => void;
  onMobileSidebarClose: () => void;
  onDesktopSidebarOpen: () => void;
  onDesktopSidebarClose: () => void;
}

const dashboardMenuLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/concursos", label: "Concursos" },
  { href: "/categorias", label: "Categorías" },
  { href: "/participaciones", label: "Participaciones" },
  { href: "/jurados", label: "Jurados" },
  { href: "/ranking", label: "Ranking" },
  { href: "/diplomas", label: "Diplomas" },
  { href: "/", label: "Ir al inicio", primary: true },
];

export function Header({
  mobileSidebarOpen,
  desktopSidebarExpanded,
  onMobileSidebarOpen,
  onMobileSidebarClose,
  onDesktopSidebarOpen,
  onDesktopSidebarClose,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <HeaderContainer variant="dashboard" relaxedHeight>
        <AppHeaderFlexZones
          alignLeftWithSidebarBand
          rowClassName="min-h-[4.5rem] items-center md:min-h-[5.5rem] lg:min-h-[6rem]"
          left={
            <>
              <Link
                href="/dashboard"
                className="flex min-w-0 items-center justify-center"
                aria-label="FotoRank"
              >
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
              {/* Escritorio: X cierra panel, hamburguesa lo abre (estado propio; sin depender de matchMedia en el header). */}
              {desktopSidebarExpanded ? (
                <button
                  type="button"
                  onClick={onDesktopSidebarClose}
                  className={`${sidebarControlBtnClass} hidden md:flex`}
                  aria-label="Ocultar menú lateral"
                >
                  <IconClose />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDesktopSidebarOpen}
                  className={`${sidebarControlBtnClass} hidden md:flex`}
                  aria-label="Mostrar menú lateral"
                >
                  <IconHamburger />
                </button>
              )}
            </>
          }
          center={null}
          right={
            <HeaderActions>
              {mobileSidebarOpen ? (
                <button
                  type="button"
                  onClick={onMobileSidebarClose}
                  className={`${sidebarControlBtnClass} md:hidden`}
                  aria-label="Cerrar menú lateral"
                >
                  <IconClose />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onMobileSidebarOpen}
                  className={`${sidebarControlBtnClass} md:hidden`}
                  aria-label="Abrir menú lateral"
                >
                  <IconHamburger />
                </button>
              )}
              <HeaderMenuToggle onClick={() => setMenuOpen(true)} />
            </HeaderActions>
          }
        />
      </HeaderContainer>

      <FullscreenMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} links={dashboardMenuLinks} logoHref="/dashboard" />
    </>
  );
}
