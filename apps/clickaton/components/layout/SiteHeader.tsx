"use client";

import { useEffect, useId, useState } from "react";
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
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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

  return (
    <header className="sticky top-0 z-50 border-b border-ck-border bg-ck-white/95 backdrop-blur-sm">
      <Container className="flex h-[4.25rem] items-center gap-6 md:h-[4.75rem] md:gap-8 lg:h-[5.25rem]">
        <div className="shrink-0">
          <Wordmark
            href={null}
            height={52}
            className="h-11 w-auto md:h-12 lg:h-14"
          />
        </div>

        <div className="ml-auto hidden items-center gap-8 xl:flex 2xl:gap-10">
          <nav className="flex items-center gap-1" aria-label="Principal">
            {mainNavigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "ck-label whitespace-nowrap rounded-[var(--ck-radius-sm)] px-3.5 py-2.5 transition-colors duration-[var(--ck-duration-fast)]",
                    active
                      ? "bg-ck-yellow text-ck-black"
                      : "text-ck-text-secondary hover:bg-ck-gray-100 hover:text-ck-text",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
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

        <div className="ml-auto flex items-center gap-3 xl:hidden">
          <Button
            href={headerCta.href}
            className="hidden whitespace-nowrap sm:inline-flex"
            size="sm"
          >
            {headerCta.label}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 px-0"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
            <span aria-hidden="true" className="flex w-5 flex-col gap-1.5">
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-black transition-transform",
                  open && "translate-y-2 rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-black transition-opacity",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-full bg-ck-black transition-transform",
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
          className="border-t border-ck-border bg-ck-white xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <Container>
            <nav className="flex flex-col gap-2 py-5" aria-label="Móvil">
              {mainNavigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-[var(--ck-radius-md)] px-4 py-3 text-base font-semibold",
                      active
                        ? "bg-ck-yellow text-ck-black"
                        : "text-ck-text hover:bg-ck-gray-100",
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
                className="mt-3 whitespace-nowrap"
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
