"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { landingSignOutAction } from "../../actions/landing-session";

/** `openLoginModal`: landing sin sesión. `signOut`: cierra admin y/o jurado. */
export type MenuLink = {
  label: string;
  href?: string;
  openLoginModal?: boolean;
  signOut?: boolean;
};

const landingNavAnchors: MenuLink[] = [
  { href: "/#como-funciona", label: "¿Cómo funciona?" },
  { href: "/#para-quien-es", label: "¿Para quién es?" },
  { href: "/#beneficios", label: "Beneficios" },
  { href: "/#ejemplos", label: "Ejemplos" },
];

export function getLandingMenuLinks(hasSession: boolean): MenuLink[] {
  return [
    ...landingNavAnchors,
    hasSession
      ? { label: "Cerrar sesión", signOut: true }
      : { label: "Iniciar sesión", openLoginModal: true },
  ];
}

const defaultMenuLinks: MenuLink[] = getLandingMenuLinks(false);

interface FullscreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links?: MenuLink[];
  logoHref?: string;
  /** Landing: al tocar «Iniciar sesión» sin submenú. */
  onRequestLoginModal?: () => void;
}

export function FullscreenMenu({
  isOpen,
  onClose,
  links = defaultMenuLinks,
  logoHref = "/",
  onRequestLoginModal,
}: FullscreenMenuProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-fr-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex h-full flex-col">
            <header className="fr-container-wide mx-auto flex items-center justify-between px-6 py-6 md:px-10">
              <Link href={logoHref} onClick={onClose} className="flex items-center" aria-label="FotoRank">
                <Image
                  src="/fotorank-logo.png"
                  alt="FotoRank"
                  width={288}
                  height={96}
                  className="h-[9rem] w-auto"
                  loading="eager"
                />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-fr-muted transition-colors hover:text-fr-primary focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-fr-bg"
                aria-label="Cerrar menú"
              >
                <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <nav className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 md:gap-5">
              {links.map((link, i) => {
                const key = link.href ?? `${link.label}-${i}-${link.signOut ? "out" : "in"}`;

                if (link.signOut) {
                  return (
                    <motion.div
                      key={key}
                      className="mt-4 flex w-full max-w-lg justify-center px-2 md:mt-6"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.08 + i * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <form action={landingSignOutAction} className="flex w-full justify-center">
                        <button
                          type="submit"
                          className="fr-btn fr-btn-primary w-full max-w-xs px-10 py-4 text-center text-base font-semibold sm:w-auto sm:min-w-[16rem]"
                        >
                          {link.label}
                        </button>
                      </form>
                    </motion.div>
                  );
                }

                if (link.openLoginModal) {
                  return (
                    <motion.div
                      key={key}
                      className="mt-4 flex w-full max-w-lg justify-center px-2 md:mt-6"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.08 + i * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onRequestLoginModal?.();
                          onClose();
                        }}
                        className="fr-btn fr-btn-primary w-full max-w-xs px-10 py-4 text-center text-base font-semibold sm:w-auto sm:min-w-[16rem]"
                      >
                        {link.label}
                      </button>
                    </motion.div>
                  );
                }

                if (!link.href) return null;

                return (
                  <motion.div
                    key={key}
                    className="w-full max-w-lg"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.08 + i * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className="block w-full py-3 text-center text-2xl font-medium tracking-tight text-fr-primary transition-colors hover:text-gold md:py-4 md:text-4xl"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="fr-container-wide mx-auto w-full border-t border-[#1a1a1a] px-6 py-6 md:px-10">
              <p className="text-center fr-caption">
                FotoRank · Herramienta para organizar concursos fotográficos
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
