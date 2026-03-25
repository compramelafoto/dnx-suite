"use client";

import Link from "next/link";
import Image from "next/image";
import SidebarNav, { type SidebarItem } from "./SidebarNav";
import HorizontalNav from "./HorizontalNav";
import { PanelIcons } from "./panel-icons";

const organizerMenu: SidebarItem[] = [
  {
    id: "eventos",
    label: "Eventos",
    path: "/organizador/dashboard",
    icon: PanelIcons.events,
  },
  {
    id: "nuevo",
    label: "Nuevo evento",
    path: "/organizador/events/new",
    icon: PanelIcons.add,
  },
  {
    id: "comunidad",
    label: "Comunidad",
    path: "/organizador/comunidad",
    icon: PanelIcons.community,
  },
  {
    id: "soporte",
    label: "Soporte",
    path: "/organizador/soporte",
    icon: PanelIcons.support,
  },
];

const organizerLogo = (
  <Link href="/organizador/dashboard" className="block">
    <Image
      src="/LOGO CLF.png"
      alt="ComprameLaFoto"
      width={140}
      height={44}
      className="h-10 w-auto object-contain"
    />
  </Link>
);

export function OrganizerSidebarTopBar() {
  return (
    <div className="flex items-center gap-3">
      {organizerLogo}
      <span className="font-semibold text-gray-900">Organizador</span>
    </div>
  );
}

export default function OrganizerSidebar({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <SidebarNav
      items={organizerMenu}
      logo={organizerLogo}
      title="Organizador"
      showHeader={showHeader}
    />
  );
}

export function OrganizerNavHorizontal() {
  return <HorizontalNav items={organizerMenu} />;
}
