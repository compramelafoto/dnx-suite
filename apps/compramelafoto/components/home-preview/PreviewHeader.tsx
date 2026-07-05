"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PREVIEW_MEGA_MENUS, type MegaMenuCategory } from "@/components/home-preview/preview-mega-menu";
import PreviewMegaMenuIcon from "@/components/home-preview/PreviewMegaMenuIcon";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { usePreviewSearch } from "@/components/home-preview/PreviewSearchContext";

function MegaMenuPanel({
  menu,
  open,
  onClose,
  align = "start",
}: {
  menu: MegaMenuCategory;
  open: boolean;
  onClose: () => void;
  align?: "start" | "center";
}) {
  const wide = menu.items.length > 4;

  return (
    <div
      className={cn(
        "hp-mega-menu absolute top-full z-50 mt-2 rounded-2xl border border-[#e5e7eb] bg-white p-3 shadow-[0_12px_40px_rgba(17,24,39,0.08)]",
        wide ? "w-[min(100vw-2rem,28rem)]" : "w-[min(100vw-2rem,20rem)]",
        align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
        open && "hp-mega-menu--open"
      )}
      role="menu"
    >
      <div className={cn("grid gap-1 min-w-0", wide ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {menu.items.map((item) => (
          <Link
            key={item.label + item.href}
            href={item.href}
            role="menuitem"
            onClick={onClose}
            className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-[#f9fafb] transition-colors min-w-0 group"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f5f2] group-hover:bg-[#f3e6dc]/60 transition-colors">
              <PreviewMegaMenuIcon name={item.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#111827]">{item.label}</span>
              <span className="block text-xs text-[#6b7280] mt-0.5 leading-snug line-clamp-2">
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DesktopMegaNav({
  openId,
  setOpenId,
}: {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const { focusHeroSearch } = usePreviewSearch();

  return (
    <nav className="hidden xl:flex items-center gap-0.5 min-w-0 flex-1 justify-center" aria-label="Principal">
      <button
        type="button"
        onClick={focusHeroSearch}
        className="px-2.5 py-2 text-sm font-medium text-[#4b5563] hover:text-[#111827] rounded-lg hover:bg-[#f9fafb] transition-colors whitespace-nowrap"
      >
        Buscar fotos
      </button>
      {PREVIEW_MEGA_MENUS.map((menu) => (
        <div
          key={menu.id}
          className="relative"
          onMouseEnter={() => setOpenId(menu.id)}
          onMouseLeave={() => setOpenId(null)}
        >
          <button
            type="button"
            aria-expanded={openId === menu.id}
            aria-haspopup="true"
            onClick={() => setOpenId(openId === menu.id ? null : menu.id)}
            className={cn(
              "inline-flex items-center gap-0.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
              openId === menu.id
                ? "text-[#111827] bg-[#f3f4f6]"
                : "text-[#4b5563] hover:text-[#111827] hover:bg-[#f9fafb]"
            )}
          >
            {menu.label}
            <svg
              className={cn("w-3.5 h-3.5 text-[#9ca3af] transition-transform", openId === menu.id && "rotate-180")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <MegaMenuPanel menu={menu} open={openId === menu.id} onClose={() => setOpenId(null)} />
        </div>
      ))}
    </nav>
  );
}

export default function PreviewHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { focusHeroSearch } = usePreviewSearch();

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setMobileExpanded(null);
  }, []);

  useEffect(() => {
    if (!openId) return;
    function onDoc(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openId]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full min-w-0 border-b border-[#e5e7eb]/80 bg-white/92 backdrop-blur-md"
    >
      <div className="container-custom min-w-0">
        <div className="flex h-16 items-center gap-3 min-w-0">
          <Link href="/home-preview" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
            <Image
              src="/watermark.png"
              alt="ComprameLaFoto"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full ring-1 ring-[#e5e7eb]"
              priority
            />
            <span className="hidden lg:block text-sm font-semibold text-[#111827] max-w-[8rem] truncate">
              ComprameLaFoto
            </span>
          </Link>

          <DesktopMegaNav openId={openId} setOpenId={setOpenId} />

          <div className="hidden xl:flex items-center gap-2 shrink-0 ml-auto">
            <Link
              href="/login"
              className="px-3 py-2 text-sm font-medium text-[#4b5563] hover:text-[#111827] rounded-lg hover:bg-[#f9fafb] transition-colors"
            >
              Ingresar
            </Link>
            <PreviewButtonLink href="/registro" variant="accent" size="sm">
              Crear cuenta
            </PreviewButtonLink>
          </div>

          <button
            type="button"
            className="xl:hidden ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="xl:hidden fixed inset-0 top-16 z-40 bg-white overflow-y-auto">
          <nav className="container-custom py-5 flex flex-col gap-1 min-w-0 pb-32" aria-label="Menú móvil">
            <button
              type="button"
              onClick={() => {
                closeMobile();
                focusHeroSearch();
              }}
              className="w-full text-left px-4 py-3 text-base font-medium text-[#111827] rounded-xl hover:bg-[#f9fafb]"
            >
              Buscar fotos
            </button>

            {PREVIEW_MEGA_MENUS.map((menu) => {
              const expanded = mobileExpanded === menu.id;
              return (
                <div key={menu.id} className="min-w-0 border-b border-[#f3f4f6] last:border-0">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-base font-medium text-[#111827]"
                    aria-expanded={expanded}
                    onClick={() => setMobileExpanded(expanded ? null : menu.id)}
                  >
                    {menu.label}
                    <svg
                      className={cn("w-5 h-5 text-[#9ca3af] transition-transform", expanded && "rotate-180")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expanded ? (
                    <ul className="m-0 p-0 list-none pb-3 space-y-0.5">
                      {menu.items.map((item) => (
                        <li key={item.label}>
                          <Link
                            href={item.href}
                            onClick={closeMobile}
                            className="flex gap-3 px-4 py-2.5 rounded-lg hover:bg-[#f9fafb] min-w-0"
                          >
                            <PreviewMegaMenuIcon name={item.icon} />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-[#111827]">{item.label}</span>
                              <span className="block text-xs text-[#6b7280] mt-0.5">{item.description}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#e5e7eb] flex flex-col gap-2">
              <PreviewButtonLink
                href="#inicio"
                variant="accent"
                size="md"
                className="w-full"
                onClick={() => {
                  closeMobile();
                  focusHeroSearch();
                }}
              >
                Buscar fotos
              </PreviewButtonLink>
              <PreviewButtonLink href="/registro" variant="secondary" size="md" className="w-full" onClick={closeMobile}>
                Crear cuenta
              </PreviewButtonLink>
              <Link
                href="/login"
                onClick={closeMobile}
                className="text-center text-sm font-medium text-[#6b7280] py-2"
              >
                Ingresar
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
