"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import SidebarNav, { type SidebarItem } from "./SidebarNav";
import HorizontalNav from "./HorizontalNav";
import { PanelIcons } from "./panel-icons";

const clientMenu: SidebarItem[] = [
  {
    id: "inicio",
    label: "Inicio",
    path: "/cliente/dashboard",
    icon: PanelIcons.home,
  },
  {
    id: "pedidos",
    label: "Mis pedidos",
    path: "/cliente/pedidos",
    icon: PanelIcons.orders,
  },
  {
    id: "soporte",
    label: "Soporte",
    path: "/cliente/soporte",
    icon: PanelIcons.support,
  },
  {
    id: "cambiar-contrasena",
    label: "Cambiar contraseña",
    path: "/cuenta/cambiar-contrasena",
    icon: PanelIcons.settings,
  },
];

const clientLogo = (
  <Link href="/cliente/dashboard" className="block">
    <Image
      src="/LOGO CLF.png"
      alt="ComprameLaFoto"
      width={140}
      height={44}
      className="h-10 w-auto object-contain"
    />
  </Link>
);

export function ClientSidebarTopBar() {
  return (
    <div className="flex items-center gap-3">
      {clientLogo}
      <span className="font-semibold text-gray-900">Cliente</span>
    </div>
  );
}

export default function ClientSidebar({ showHeader = true }: { showHeader?: boolean }) {
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function pollUnread() {
      try {
        const res = await fetch("/api/support/unread-count", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setSupportUnread(Number(data?.count) || 0);
      } catch {
        if (!cancelled) setSupportUnread(0);
      }
    }
    pollUnread();
    const intervalId = window.setInterval(pollUnread, 75_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <SidebarNav
      items={clientMenu}
      logo={clientLogo}
      title="Cliente"
      showHeader={showHeader}
      dynamicBadgeCounts={supportUnread > 0 ? { soporte: supportUnread } : {}}
    />
  );
}

export function ClientNavHorizontal() {
  return <HorizontalNav items={clientMenu} />;
}
