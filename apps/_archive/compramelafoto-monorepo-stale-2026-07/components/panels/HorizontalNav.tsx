"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { SidebarItem } from "./SidebarNav";

type Props = {
  items: SidebarItem[];
  activeClass?: string;
  inactiveClass?: string;
};

const defaultActiveClass = "bg-[#c27b3d]/12 text-[#c27b3d] font-medium";
const defaultInactiveClass = "text-gray-700 hover:bg-gray-100";

export default function HorizontalNav({
  items,
  activeClass = defaultActiveClass,
  inactiveClass = defaultInactiveClass,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

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
    setOpenId(null);
  }, [pathname]);

  return (
    <nav
      className="hidden md:flex flex-shrink-0 items-center gap-0 bg-white border-b border-gray-200 px-2 overflow-x-auto"
      aria-label="Menú principal"
    >
      <ul className="flex items-center gap-0 min-w-0">
        {items.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openId === item.id;
          const groupActive = isGroupActive(item);

          if (hasChildren) {
            return (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    groupActive
                      ? "border-[#c27b3d] text-[#c27b3d] " + activeClass
                      : "border-transparent " + inactiveClass
                  }`}
                >
                  {item.icon && <span className="flex-shrink-0 w-4 flex items-center justify-center">{item.icon}</span>}
                  {item.label}
                  {item.badge && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500 text-white">
                      {item.badge}
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setOpenId(null)}
                    />
                    <ul
                      className="absolute left-0 top-full z-20 mt-0 py-1 min-w-[180px] bg-white rounded-b-lg shadow-lg border border-gray-200"
                      role="menu"
                    >
                      {item.children!.map((sub) => {
                        const subHref = hrefFor(item, sub);
                        const subActive = isActive(item, sub);
                        return (
                          <li key={sub.id} role="none">
                            <Link
                              href={subHref}
                              role="menuitem"
                              onClick={() => setOpenId(null)}
                              className={`block pl-5 pr-4 py-2.5 text-sm transition-colors ${subActive ? activeClass : inactiveClass}`}
                            >
                              {sub.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
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
                className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  singleActive ? "border-[#c27b3d] " + activeClass : "border-transparent " + inactiveClass
                }`}
              >
                {item.icon && <span className="flex-shrink-0 w-4 flex items-center justify-center">{item.icon}</span>}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
