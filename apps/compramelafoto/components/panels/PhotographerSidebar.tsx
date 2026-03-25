"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import SidebarNav, { type SidebarItem } from "./SidebarNav";
import HorizontalNav from "./HorizontalNav";
import { PanelIcons } from "./panel-icons";
import { getPhotographerSidebarItems } from "@/config/navigation";

const photographerMenu: SidebarItem[] = getPhotographerSidebarItems({
  home: PanelIcons.home,
  albums: PanelIcons.albums,
  orders: PanelIcons.orders,
  clients: PanelIcons.clients,
  settings: PanelIcons.settings,
  removal: PanelIcons.removal,
  support: PanelIcons.support,
  community: PanelIcons.community,
  design: PanelIcons.design,
  schools: PanelIcons.schools,
});

const CLF_LOGO = "/LOGO CLF.png";

/** Segunda barra superior (logo de la empresa o ComprameLaFoto + tipo de usuario). No muestra logo hasta saber si hay uno propio para evitar parpadeo. */
export function PhotographerSidebarTopBar({
  logoUrl,
  logoFetched,
}: {
  logoUrl?: string | null;
  logoFetched?: boolean;
}) {
  const showPlaceholder = logoFetched === false;
  const src = logoFetched ? (logoUrl?.trim() || CLF_LOGO) : null;
  const isExternal = src?.startsWith("http") ?? false;

  return (
    <div className="flex items-center gap-3">
      <Link href="/fotografo/dashboard" className="block flex-shrink-0 h-10 min-w-[80px]">
        {showPlaceholder ? (
          <span className="block h-10 w-[120px] bg-gray-100 rounded animate-pulse" aria-hidden />
        ) : src ? (
          <Image
            src={src}
            alt="Logo"
            width={140}
            height={44}
            className="h-10 w-auto object-contain max-w-[140px]"
            unoptimized={isExternal}
            priority
          />
        ) : null}
      </Link>
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-gray-700 rounded-md bg-gray-100/90 opacity-75">
        Fotógrafo
      </span>
    </div>
  );
}

const photographerLogo = (
  <Link href="/fotografo/dashboard" className="block">
    <Image
      src={CLF_LOGO}
      alt="ComprameLaFoto"
      width={140}
      height={44}
      className="h-10 w-auto object-contain"
    />
  </Link>
);

export default function PhotographerSidebar({ showHeader = true }: { showHeader?: boolean }) {
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    fetch("/api/support/unread-count", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSupportUnread(d?.count ?? 0))
      .catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem("photographer");
    sessionStorage.removeItem("photographerId");
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.location.assign("/login?logout=success");
  }, []);

  return (
    <SidebarNav
      items={photographerMenu}
      logo={photographerLogo}
      title="Fotógrafo"
      showHeader={showHeader}
      dynamicBadgeCounts={supportUnread > 0 ? { soporte: supportUnread } : {}}
      bottomAction={{
        label: "Cerrar sesión",
        onClick: handleLogout,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        ),
      }}
    />
  );
}

export function PhotographerNavHorizontal() {
  return <HorizontalNav items={photographerMenu} />;
}

export { photographerMenu };
