"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  buildAlbumWorkspaceNavAreas,
  resolveAlbumWorkspaceAreaFromLegacyTab,
  resolveLegacyTabForWorkspaceAreaClick,
  type AlbumDashboardLegacyTabId,
  type AlbumPublicationPanelId,
  type AlbumWorkspaceAreaId,
} from "@/lib/albums/album-dashboard-nav";

export type AlbumWorkspaceNavProps = {
  activeTab: AlbumDashboardLegacyTabId;
  publicationPanel?: AlbumPublicationPanelId;
  videoMvpEnabled: boolean;
  schoolLinked: boolean;
  schoolAlbumMode?: boolean;
  commercialUnifiedUiEnabled?: boolean;
  onTabChange: (tab: AlbumDashboardLegacyTabId) => void;
  onPublicationPanelChange?: (panel: AlbumPublicationPanelId) => void;
  sticky?: boolean;
  className?: string;
};

const areaButtonClass = (active: boolean) =>
  cn(
    "inline-flex min-h-[2.5rem] shrink-0 items-center justify-center px-3.5 py-2 text-sm font-medium leading-snug transition-colors sm:min-h-[2.75rem] sm:px-4",
    "whitespace-nowrap rounded-lg",
    active
      ? "bg-[#fdf8f3] text-[#c27b3d] font-semibold ring-1 ring-[#c27b3d]/20"
      : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#1a1a1a]"
  );

const subTabButtonClass = (active: boolean) =>
  cn(
    "inline-flex min-h-[2.25rem] shrink-0 items-center justify-center px-3.5 py-1.5 text-sm font-medium leading-snug transition-colors sm:min-h-[2.5rem] sm:px-4",
    "whitespace-nowrap rounded-t-lg border-b-2 -mb-px",
    active
      ? "border-[#c27b3d] text-[#c27b3d] bg-white font-semibold"
      : "border-transparent text-[#6b7280] hover:text-[#1a1a1a] hover:border-[#e5e7eb] hover:bg-white/80"
  );

export default function AlbumWorkspaceNav({
  activeTab,
  publicationPanel,
  videoMvpEnabled,
  schoolLinked,
  schoolAlbumMode = false,
  commercialUnifiedUiEnabled = false,
  onTabChange,
  onPublicationPanelChange,
  sticky = true,
  className,
}: AlbumWorkspaceNavProps) {
  const areas = useMemo(
    () =>
      buildAlbumWorkspaceNavAreas({
        videoMvpEnabled,
        schoolLinked,
        schoolAlbumMode,
        commercialUnifiedUiEnabled,
      }),
    [videoMvpEnabled, schoolLinked, schoolAlbumMode, commercialUnifiedUiEnabled]
  );

  const currentArea = resolveAlbumWorkspaceAreaFromLegacyTab(activeTab);
  const currentAreaConfig =
    areas.find((area) => area.id === currentArea) ?? areas[0] ?? null;
  const showSubTabs = (currentAreaConfig?.subtabs.length ?? 0) > 1;

  const areaBarRef = useRef<HTMLDivElement>(null);
  const subTabBarRef = useRef<HTMLDivElement>(null);
  const areaButtonRefs = useRef<Partial<Record<AlbumWorkspaceAreaId, HTMLButtonElement>>>({});
  const subTabButtonRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({});

  useEffect(() => {
    const btn = areaButtonRefs.current[currentArea];
    const bar = areaBarRef.current;
    if (!btn || !bar) return;
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [currentArea, areas]);

  useEffect(() => {
    if (!showSubTabs) return;
    const activeSubKey = (() => {
      if (activeTab === "publicacion" && publicationPanel) {
        return `publicacion-${publicationPanel}`;
      }
      const match = currentAreaConfig?.subtabs.find((s) => s.id === activeTab);
      return match?.navKey ?? activeTab;
    })();
    const btn = subTabButtonRefs.current[activeSubKey];
    const bar = subTabBarRef.current;
    if (!btn || !bar) return;
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeTab, publicationPanel, showSubTabs, currentAreaConfig]);

  const handleAreaClick = (areaId: AlbumWorkspaceAreaId) => {
    if (areaId === "venta" && currentArea === "venta" && activeTab !== "ventas") {
      onTabChange("ventas");
      return;
    }
    if (areaId === currentArea) return;
    const nextTab = resolveLegacyTabForWorkspaceAreaClick(areaId, activeTab, {
      videoMvpEnabled,
      schoolLinked,
    });
    if (nextTab !== activeTab) onTabChange(nextTab);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 w-full max-w-full shrink-0 flex-col bg-white border border-[#e5e7eb] rounded-xl overflow-hidden",
        sticky && "sticky top-0 z-20",
        className
      )}
    >
      <div ref={areaBarRef} className="border-b border-[#f1f5f9] ds-overflow-x-soft touch-pan-x">
        <div
          role="tablist"
          aria-label="Áreas del álbum"
          className="flex w-max min-w-full flex-nowrap gap-1 px-2 py-2 sm:px-3"
        >
          {areas.map((area) => {
            const isActive = area.id === currentArea;
            return (
              <button
                key={area.id}
                ref={(el) => {
                  areaButtonRefs.current[area.id] = el ?? undefined;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleAreaClick(area.id)}
                className={areaButtonClass(isActive)}
              >
                {area.label}
              </button>
            );
          })}
        </div>
      </div>

      {showSubTabs && currentAreaConfig ? (
        <div
          ref={subTabBarRef}
          className="border-b border-[#f1f5f9] bg-[#fafafa] ds-overflow-x-soft touch-pan-x"
        >
          <div
            role="tablist"
            aria-label={`Secciones de ${currentAreaConfig.label}`}
            className="flex w-max min-w-full flex-nowrap gap-0.5 px-2 pb-px pt-1 sm:px-3"
          >
            {currentAreaConfig.subtabs.map((subtab) => {
              const subKey =
                subtab.publicationPanel != null
                  ? `publicacion-${subtab.publicationPanel}`
                  : (subtab.navKey ?? subtab.id);
              const isActive =
                subtab.id === "publicacion"
                  ? activeTab === "publicacion" &&
                    (publicationPanel ?? "compartir") === subtab.publicationPanel
                  : subtab.id === activeTab;

              return (
                <button
                  key={subKey}
                  ref={(el) => {
                    subTabButtonRefs.current[subKey] = el ?? undefined;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (subtab.id === "publicacion" && subtab.publicationPanel) {
                      if (activeTab !== "publicacion") onTabChange("publicacion");
                      onPublicationPanelChange?.(subtab.publicationPanel);
                      return;
                    }
                    if (subtab.id !== activeTab) onTabChange(subtab.id);
                  }}
                  className={subTabButtonClass(isActive)}
                >
                  {subtab.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
