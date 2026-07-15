"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { headerCta, mainNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
        scrolled || open
          ? "border-ck-border bg-[rgb(17_17_17_/_0.78)] shadow-[var(--ck-shadow-subtle)] backdrop-blur-[var(--ck-blur-header)]"
          : "border-transparent bg-transparent backdrop-blur-0",
      )}
    >
      <Container className="flex h-14 items-center gap-4 md:h-16 md:gap-8">
        <div className="min-w-0 shrink-0">
          <Wordmark
            href={null}
            tone="inverse"
            height={44}
            className="h-8 w-auto max-w-[10.5rem] sm:h-9 sm:max-w-none md:h-10"
          />
        </div>

        <div className="ml-auto hidden items-center gap-6 lg:gap-8 xl:flex 2xl:gap-10">
          <nav className="flex items-center gap-1" aria-label="Principal">
            {mainNavigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "ck-label whitespace-nowrap rounded-[var(--ck-radius-sm)] px-3 py-2 transition-colors duration-[var(--ck-duration-base)]",
                    active
                      ? "text-ck-yellow"
                      : "text-ck-text-secondary hover:text-ck-text",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active ? (
                    <span className="relative">
                      {item.label}
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-1 h-px bg-ck-yellow"
                      />
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </nav>

          <Button
            href={headerCta.href}
            size="sm"
            className="shrink-0 whitespace-nowrap px-5"
          >
            {headerCta.label}
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 xl:hidden">
          <Button
            href={headerCta.href}
            className="hidden whitespace-nowrap sm:inline-flex"
            size="sm"
          >
            {headerCta.label}
          </Button>

          <Button
            ref={menuButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 px-0"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true" className="flex w-5 flex-col gap-1.5">
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-text transition-transform duration-[var(--ck-duration-base)]",
                  open && "translate-y-2 rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-text transition-opacity duration-[var(--ck-duration-base)]",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-text transition-transform duration-[var(--ck-duration-base)]",
                  open && "-translate-y-2 -rotate-45",
                )}
              />
            </span>
          </Button>
        </div>
      </Container>

      {open ? (
        <div
          id={panelId}
          className="max-h-[min(80dvh,36rem)] overflow-y-auto border-t border-ck-border bg-[rgb(17_17_17_/_0.98)] backdrop-blur-[var(--ck-blur-header)] xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <Container>
            <div className="flex items-center justify-between border-b border-ck-border py-3">
              <p className="ck-overline text-ck-yellow">Navegación</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Cerrar menú"
                onClick={() => {
                  setOpen(false);
                  menuButtonRef.current?.focus();
                }}
              >
                Cerrar
              </Button>
            </div>
            <nav className="flex flex-col gap-1 py-4" aria-label="Móvil">
              {mainNavigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-[var(--ck-radius-md)] px-4 py-3 text-base font-semibold transition-colors duration-[var(--ck-duration-base)]",
                      active
                        ? "bg-ck-surface-strong text-ck-yellow"
                        : "text-ck-text hover:bg-ck-surface-strong",
                    )}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Button
                href={headerCta.href}
                className="mt-3 w-full whitespace-nowrap"
                onClick={() => setOpen(false)}
              >
                {headerCta.label}
              </Button>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
