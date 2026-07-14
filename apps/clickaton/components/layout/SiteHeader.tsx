"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { headerCta, mainNavigation, routes } from "@/config/navigation";
import { cn } from "@/lib/cn";

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
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-[4.25rem]">
        <Wordmark href={routes.home} />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Principal">
          {mainNavigation.map((item) => {
            const active =
              item.href === routes.home
                ? pathname === routes.home
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "ck-label rounded-[var(--ck-radius-sm)] px-2.5 py-2 transition-colors duration-[var(--ck-duration-fast)]",
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

        <div className="flex items-center gap-2">
          <Button href={headerCta.href} className="hidden sm:inline-flex" size="sm">
            {headerCta.label}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-11 px-3 xl:hidden"
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
            <nav className="flex flex-col gap-1 py-4" aria-label="Móvil">
              {mainNavigation.map((item) => {
                const active =
                  item.href === routes.home
                    ? pathname === routes.home
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "ck-label rounded-[var(--ck-radius-sm)] px-3 py-3",
                      active ? "bg-ck-yellow text-ck-black" : "text-ck-text hover:bg-ck-gray-100",
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
                className="mt-2"
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
