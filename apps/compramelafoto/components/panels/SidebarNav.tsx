"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type SidebarItem = {
  id: string;
  label: string;
  path?: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string;
  children?: { id: string; label: string; path?: string; href?: string; tab?: string; badge?: string }[];
};

type Props = {
  items: SidebarItem[];
  logo: React.ReactNode;
  title: string;
  badge?: string;
  activeClass?: string;
  inactiveClass?: string;
  /** Si false, no se muestra el bloque logo/título (para cuando se usa segunda barra full-width) */
  showHeader?: boolean;
  /** Contador dinámico por item id (ej. { soporte: 3 } para mostrar badge con número) */
  dynamicBadgeCounts?: Record<string, number>;
  /** Acción fija al fondo del panel lateral (ej. cerrar sesión). */
  bottomAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
};

const defaultActiveClass = "bg-[#c27b3d]/12 text-[#c27b3d] font-medium border-l-[3px] border-[#c27b3d]";
const defaultInactiveClass = "text-gray-700 hover:bg-gray-50";

export default function SidebarNav({
  items,
  logo,
  title,
  badge,
  activeClass = defaultActiveClass,
  inactiveClass = defaultInactiveClass,
  showHeader = true,
  dynamicBadgeCounts = {},
  bottomAction,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function hrefFor(item: SidebarItem, child?: { path?: string; href?: string; tab?: string }) {
    if (child) {
      const base = child.path || child.href || item.path || item.href || "#";
      const tab = child.tab;
      if (tab && base && !base.includes("?")) return `${base}?tab=${tab}`;
      return base;
    }
    return item.path || item.href || "#";
  }

  function isActive(item: SidebarItem, child?: { path?: string; href?: string; tab?: string }) {
    const h = hrefFor(item, child);
    if (!h || h === "#") return false;
    const [path, query] = h.split("?");
    const currentPath = pathname || "";
    const matchPath = currentPath === path || (path !== "/" && currentPath.startsWith(path + "/"));
    if (!matchPath) return false;
    if (query) {
      const tab = new URLSearchParams(query).get("tab");
      const currentTab = searchParams?.get("tab") || "";
      return tab === currentTab;
    }
    if (child?.tab) {
      return (searchParams?.get("tab") || "") === child.tab;
    }
    return true;
  }

  function isGroupActive(item: SidebarItem) {
    if (item.path || item.href) {
      const h = item.path || item.href || "";
      const [path] = h.split("?");
      const currentPath = pathname || "";
      if (path && (currentPath === path || currentPath.startsWith(path + "/"))) return true;
    }
    return item.children?.some((c) => isActive(item, c)) ?? false;
  }

  useEffect(() => {
    const next = new Set(expandedIds);
    items.forEach((item) => {
      if (item.children?.length) {
        const open = isGroupActive(item);
        if (open) next.add(item.id);
        else next.delete(item.id);
      }
    });
    setExpandedIds(next);
  }, [pathname, searchParams, items]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="w-[240px] flex-shrink-0 bg-white border-r border-gray-200 min-h-full flex flex-col">
      {showHeader && (
        <div className="p-4 pb-8 border-b border-gray-100">
          {logo}
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold text-gray-900 truncate">{title}</span>
            {badge && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                {badge}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Zona del menú: más abajo (padding grande para que arranque bien debajo) */}
      <nav className={`flex-1 min-h-0 overflow-y-auto p-3 ${showHeader ? "pt-20 md:pt-24" : "pt-8"}`} aria-label="Menú principal">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = expandedIds.has(item.id);
            const groupActive = isGroupActive(item);

            if (hasChildren) {
              const groupHref = item.path || item.href || "#";
              return (
                <li key={item.id}>
                  <div className={`flex items-center gap-0 px-3 py-2.5 md:py-2.5 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors touch-manipulation ${
                    groupActive ? "bg-[#c27b3d]/10 text-[#c27b3d]" : inactiveClass
                  }`}>
                    <Link
                      href={groupHref}
                      className={`flex-1 flex items-center gap-3 min-w-0 rounded-lg py-0.5 -my-0.5 min-h-[44px] md:min-h-0 items-center ${
                        groupActive ? "text-[#c27b3d]" : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      {item.icon && <span className="flex-shrink-0 w-5 flex items-center justify-center">{item.icon}</span>}
                      <span className="truncate">{item.label}</span>
                      {(dynamicBadgeCounts[item.id] ?? 0) > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white px-1">
                          {dynamicBadgeCounts[item.id]! > 99 ? "99+" : dynamicBadgeCounts[item.id]}
                        </span>
                      )}
                      {!dynamicBadgeCounts[item.id] && item.badge && (
                        <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggle(item.id);
                      }}
                      className="flex-shrink-0 p-1 rounded hover:bg-black/5"
                      aria-label={isOpen ? "Cerrar" : "Abrir"}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="ml-5 mt-0.5 pl-4 border-l-2 border-gray-200 space-y-0.5">
                      {item.children!.map((sub) => {
                        const subHref = hrefFor(item, sub);
                        const subActive = isActive(item, sub);
                        return (
                          <li key={sub.id}>
                            <Link
                              href={subHref}
                              className={`flex items-center gap-2 min-h-[44px] md:min-h-0 pl-5 pr-3 py-3 md:py-2 rounded-lg text-sm transition-colors touch-manipulation active:bg-gray-100 ${
                                subActive ? activeClass : inactiveClass
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              {"badge" in sub && sub.badge && (
                                <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                                  {sub.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            const linkHref = hrefFor(item);
            const singleActive = isActive(item);
            return (
              <li key={item.id}>
                <Link
                  href={linkHref}
                  className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors touch-manipulation active:bg-gray-100 ${
                    singleActive ? activeClass : inactiveClass
                  }`}
                >
                  {item.icon && <span className="flex-shrink-0 w-5 flex items-center justify-center">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {bottomAction ? (
        <div className="border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={bottomAction.onClick}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#c27b3d] transition-colors hover:bg-[#c27b3d]/10 hover:text-[#a86a33]"
          >
            {bottomAction.icon ? (
              <span className="flex w-5 flex-shrink-0 items-center justify-center">{bottomAction.icon}</span>
            ) : null}
            <span className="truncate">{bottomAction.label}</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
