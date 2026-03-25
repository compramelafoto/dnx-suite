"use client";

import Link from "next/link";
import Image from "next/image";
import SidebarNav, { type SidebarItem } from "./SidebarNav";
import HorizontalNav from "./HorizontalNav";
import { PanelIcons } from "./panel-icons";
import { getLabSidebarItems } from "@/config/navigation";

const labMenu: SidebarItem[] = getLabSidebarItems({
  home: PanelIcons.home,
  orders: PanelIcons.orders,
  albums: PanelIcons.albums,
  clients: PanelIcons.clients,
  products: PanelIcons.products,
  settings: PanelIcons.settings,
  community: PanelIcons.community,
  support: PanelIcons.support,
});

const CLF_LOGO = "/LOGO CLF.png";

/** Segunda barra superior (logo del laboratorio o ComprameLaFoto + tipo de usuario). No muestra logo hasta saber si hay uno propio para evitar parpadeo. */
export function LabSidebarTopBar({
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
      <Link href="/lab/dashboard" className="block flex-shrink-0 h-10 min-w-[80px]">
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
      <span className="font-semibold text-gray-900">Laboratorio</span>
    </div>
  );
}

const labLogo = (
  <Link href="/lab/dashboard" className="block">
    <Image
      src={CLF_LOGO}
      alt="ComprameLaFoto"
      width={140}
      height={44}
      className="h-10 w-auto object-contain"
    />
  </Link>
);

export default function LabSidebar({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <SidebarNav
      items={labMenu}
      logo={labLogo}
      title="Laboratorio"
      showHeader={showHeader}
      activeClass="bg-[#3b82f6]/12 text-[#2563eb] font-medium border-l-[3px] border-[#2563eb]"
      inactiveClass="text-gray-700 hover:bg-gray-50"
    />
  );
}

export function LabNavHorizontal() {
  return (
    <HorizontalNav
      items={labMenu}
      activeClass="bg-[#3b82f6]/12 text-[#2563eb] font-medium"
      inactiveClass="text-gray-700 hover:bg-gray-100"
    />
  );
}
