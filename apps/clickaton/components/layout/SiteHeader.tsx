"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { AccountMenu, type HeaderAuthUser } from "@/components/layout/AccountMenu";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import {
  aboutSectionNavigation,
  headerCta,
  mainNavigation,
  routes,
} from "@/config/navigation";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { cn } from "@/lib/cn";

function isActivePath(pathname: string, href: string) {
  const pathOnly = href.split("#")[0] || href;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

function isAboutSectionLink(href: string, hash: string) {
  if (!href.includes("#")) return false;
  const targetHash = href.split("#")[1] || "";
  return hash === `#${targetHash}`;
}

type Props = {
  authUser?: HeaderAuthUser | null;
};

export function SiteHeader({ authUser = null }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hash, setHash] = useState("");
  const panelId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const onAboutPage = pathname === routes.about;
  const navigation = onAboutPage ? aboutSectionNavigation : mainNavigation;

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
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const loginHref =
    pathname && pathname !== CLICKATON_LOGIN_PATH
      ? `${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`
      : CLICKATON_LOGIN_PATH;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter,box-shadow] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
        scrolled || open
          ? "border-ck-border bg-[rgb(17_17_17_/_0.78)] shadow-[var(--ck-shadow-subtle)] backdrop-blur-[var(--ck-blur-header)]"
          : "border-transparent bg-transparent backdrop-blur-0",
      )}
    >
      <Container className="flex min-h-24 items-center gap-4 py-5 md:min-h-28 md:gap-8 md:py-6">
        <div className="flex shrink-0 items-center">
          <Wordmark
            href="/"
            tone="inverse"
            height={80}
            className="h-14 w-auto max-w-[10.5rem] sm:h-16 sm:max-w-[12rem] md:h-[4.5rem] md:max-w-[13.5rem]"
          />
        </div>

        <div className="ml-auto hidden items-center gap-6 lg:gap-8 xl:flex 2xl:gap-10">
          <nav
            className="flex items-center gap-1"
            aria-label={onAboutPage ? "Secciones Sobre Clickatón" : "Principal"}
          >
            {navigation.map((item) => {
              const active = onAboutPage
                ? isAboutSectionLink(item.href, hash)
                : isActivePath(pathname, item.href);

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
                  onClick={() => {
                    if (item.href.includes("#")) {
                      setHash(`#${item.href.split("#")[1] || ""}`);
                    }
                  }}
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

          <div className="flex shrink-0 items-center gap-3">
            {authUser ? (
              <AccountMenu user={authUser} />
            ) : (
              <Button
                href={loginHref}
                variant="secondary"
                size="sm"
                className="whitespace-nowrap px-5"
              >
                Iniciar sesión
              </Button>
            )}
            <Button
              href={headerCta.href}
              size="sm"
              className="whitespace-nowrap px-5"
            >
              {headerCta.label}
            </Button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 xl:hidden">
          {authUser ? (
            <AccountMenu user={authUser} />
          ) : (
            <Button
              href={loginHref}
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
            >
              Iniciar sesión
            </Button>
          )}

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
            <nav
              className="flex flex-col gap-1 py-4"
              aria-label={onAboutPage ? "Secciones Sobre Clickatón" : "Móvil"}
            >
              {navigation.map((item) => {
                const active = onAboutPage
                  ? isAboutSectionLink(item.href, hash)
                  : isActivePath(pathname, item.href);

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
                    onClick={() => {
                      if (item.href.includes("#")) {
                        setHash(`#${item.href.split("#")[1] || ""}`);
                      }
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {!authUser ? (
                <Button
                  href={loginHref}
                  variant="secondary"
                  className="mt-3 w-full whitespace-nowrap"
                  onClick={() => setOpen(false)}
                >
                  Iniciar sesión
                </Button>
              ) : null}
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
