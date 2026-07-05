"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import SidebarNav, { type SidebarItem } from "./SidebarNav";
import HorizontalNav from "./HorizontalNav";
import { PanelIcons } from "./panel-icons";
import { getPhotographerSidebarItems } from "@/config/navigation";
import { isGlobalProductsCatalogPhase1EnabledClient } from "@/lib/catalog-products/feature-flag";

const CLF_LOGO = "/LOGO CLF.png";

function usePhotographerMenuItems(catalogProductsEnabled: boolean): SidebarItem[] {
  return useMemo(() => {
    const items = getPhotographerSidebarItems({
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
      events: PanelIcons.events,
      analytics: PanelIcons.analytics,
      sales: PanelIcons.prices,
    });
    if (catalogProductsEnabled) return items;
    return items.map((item) =>
      item.id === "ventas" && item.children
        ? {
            ...item,
            children: item.children.filter((c) => c.id !== "v-productos"),
          }
        : item
    );
  }, [catalogProductsEnabled]);
}

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
  const [catalogEnabled, setCatalogEnabled] = useState(
    isGlobalProductsCatalogPhase1EnabledClient()
  );
  const items = usePhotographerMenuItems(catalogEnabled);
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    if (isGlobalProductsCatalogPhase1EnabledClient()) {
      setCatalogEnabled(true);
      return;
    }
    let cancelled = false;
    fetch("/api/dashboard/catalog-products-phase1-enabled", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setCatalogEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setCatalogEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      items={items}
      logo={photographerLogo}
      title="Fotógrafo"
      showHeader={showHeader}
      dynamicBadgeCounts={supportUnread > 0 ? { soporte: supportUnread } : {}}
    />
  );
}

export function PhotographerNavHorizontal() {
  const [catalogEnabled, setCatalogEnabled] = useState(
    isGlobalProductsCatalogPhase1EnabledClient()
  );
  const items = usePhotographerMenuItems(catalogEnabled);

  useEffect(() => {
    if (isGlobalProductsCatalogPhase1EnabledClient()) {
      setCatalogEnabled(true);
      return;
    }
    fetch("/api/dashboard/catalog-products-phase1-enabled", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => setCatalogEnabled(Boolean(data.enabled)))
      .catch(() => setCatalogEnabled(false));
  }, []);

  return <HorizontalNav items={items} />;
}
