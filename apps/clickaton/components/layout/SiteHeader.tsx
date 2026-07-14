"use client";

import { useEffect, useId, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { mainNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

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

  return (
    <header className="sticky top-0 z-50 border-b border-ck-border bg-ck-white/95 backdrop-blur-sm">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {mainNavigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-[var(--ck-radius-sm)] px-3 py-2 text-sm font-medium text-ck-text-secondary transition-colors hover:bg-ck-gray-100 hover:text-ck-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button href="#proximas-maratones" className="hidden sm:inline-flex" size="sm">
            Próximamente
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-11 px-3 lg:hidden"
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
          className="border-t border-ck-border bg-ck-white lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <Container>
            <nav className="flex flex-col gap-1 py-4" aria-label="Móvil">
              {mainNavigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-[var(--ck-radius-sm)] px-3 py-3 text-base font-medium text-ck-text hover:bg-ck-gray-100"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Button
                href="#proximas-maratones"
                className="mt-2"
                onClick={() => setOpen(false)}
              >
                Conocé Clickaton
              </Button>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
