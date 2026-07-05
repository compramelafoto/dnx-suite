"use client";

import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: Array<{ id: string; label: string; icon?: ReactNode }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  contentClassName?: string;
  /** Barra de solapas fija al hacer scroll (p. ej. detalle admin con mucho contenido). */
  stickyTabBar?: boolean;
  tabBarClassName?: string;
  children: ReactNode;
}

export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
  contentClassName,
  stickyTabBar,
  tabBarClassName,
  children,
}: TabsProps) {
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const btn = tabButtonRefs.current[activeTab];
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeTab, tabs]);

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col basis-auto">
      {/* Tab Headers */}
      <div
        className={cn(
          "border-b border-[#e5e7eb] bg-white shrink-0 ds-overflow-x-soft touch-pan-x",
          stickyTabBar && "sticky top-0 z-20 shadow-sm shadow-[#e5e7eb]/40",
          tabBarClassName
        )}
        ref={tabBarRef}
      >
        <div
          role="tablist"
          aria-label="Secciones del álbum. En pantallas chicas, deslizá horizontalmente para ver más pestañas."
          className="flex w-max min-w-full flex-nowrap gap-0.5 px-2 pb-px sm:gap-1 sm:px-3"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[tab.id] = el;
              }}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium leading-snug transition-colors sm:min-h-[3rem] sm:px-5",
                "whitespace-nowrap rounded-t-lg",
                "border-b-2 -mb-[1px]",
                activeTab === tab.id
                  ? "border-[#c27b3d] text-[#c27b3d] bg-[#fdf8f3]/90 font-semibold"
                  : "border-transparent text-[#6b7280] hover:text-[#1a1a1a] hover:border-[#e5e7eb] hover:bg-[#f9fafb]"
              )}
            >
              {tab.icon ? <span className="shrink-0 text-current opacity-90">{tab.icon}</span> : null}
              <span className="min-w-0">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div
        className={cn(
          "mt-4 flex w-full min-w-0 max-w-full flex-1 min-h-0 flex-col",
          "[&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-full",
          contentClassName,
          "items-stretch self-stretch",
        )}
      >
        {children}
      </div>
    </div>
  );
}
