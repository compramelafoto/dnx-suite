"use client";

import type { ReactNode } from "react";
import { useResolvedTheme } from "@repo/design-system";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  contentClassName?: string;
  children: ReactNode;
}

export default function Tabs({ tabs, activeTab, onTabChange, contentClassName, children }: TabsProps) {
  const theme = useResolvedTheme();
  const accent = theme.brand.primary;

  return (
    <div className="w-full flex flex-col min-h-0 flex-1">
      <div className="border-b overflow-x-auto shrink-0" style={{ borderColor: theme.border.subtle }}>
        <div className="flex gap-2 min-w-max px-4 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-4 sm:px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px",
                activeTab === tab.id ? "border-current" : "border-transparent hover:opacity-90"
              )}
              style={{
                color: activeTab === tab.id ? accent : theme.text.secondary,
                borderBottomColor: activeTab === tab.id ? accent : "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-2 flex-1 min-h-0 flex flex-col", contentClassName)}>{children}</div>
    </div>
  );
}
