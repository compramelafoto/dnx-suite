"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
} | null;

type UserInfo = {
  type: string;
  name: string;
  id: number;
};

type ComprameLaFotoFullscreenMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  directoryCounts: DirectoryCounts;
  user: UserInfo | null;
  loading: boolean;
};

export default function ComprameLaFotoFullscreenMenu({
  isOpen,
  onClose,
  directoryCounts,
  user,
  loading,
}: ComprameLaFotoFullscreenMenuProps) {
  const [entered, setEntered] = useState(false);
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
      setEntered(false);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => {
        cancelAnimationFrame(id);
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleEscape);
      };
    }
    return;
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const panelHref =
    user?.type === "photographer"
      ? "/fotografo/configuracion"
      : user?.type === "client"
        ? "/cliente/pedidos"
        : user?.type === "lab"
          ? "/lab/dashboard"
          : user?.type === "admin"
            ? "/admin"
            : user?.type === "organizer"
              ? "/organizador/dashboard"
              : null;

  const menuLinks: Array<{ href: string; label: string; accent?: boolean }> = [
    ...(panelHref ? [{ href: panelHref, label: "Ir al panel" }] : []),
    { href: "/", label: "Inicio" },
    { href: "/tutoriales", label: "Tutoriales" },
    { href: "/directorio/fotografos", label: "Fotógrafos", accent: (directoryCounts?.photographers ?? 0) > 0 },
    { href: "/directorio/laboratorios", label: "Laboratorios", accent: (directoryCounts?.labs ?? 0) > 0 },
    {
      href: "/directorio/servicios-para-fotografos",
      label: "Servicios para fotógrafos",
      accent: (directoryCounts?.photographerServices ?? 0) > 0,
    },
    {
      href: "/directorio/servicios-de-eventos",
      label: "Servicios de eventos",
      accent: (directoryCounts?.eventVendors ?? 0) > 0,
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#f7f5f2] transition-opacity duration-300 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
    >
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" onClick={onClose} className="flex min-w-0 items-center gap-3" aria-label="ComprameLaFoto — inicio">
          <Image
            src="/LOGO CLF.png"
            alt="ComprameLaFoto"
            width={1024}
            height={220}
            className="h-[4.25rem] w-auto max-w-[min(72vw,18rem)] object-contain object-left md:h-[5rem]"
            priority
          />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-[#6b7280] transition-colors hover:text-[#1a1a1a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40"
          aria-label="Cerrar menú"
        >
          <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <nav className="flex flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-6 md:gap-3">
        {menuLinks.map((link, idx) => (
          <MenuLink
            key={link.href}
            href={link.href}
            onNavigate={onClose}
            accent={link.accent}
            entered={entered}
            delayMs={60 + idx * 45}
          >
            {link.label}
          </MenuLink>
        ))}

        {!loading && !user && (
          <div
            className={`mt-6 flex w-full max-w-lg justify-center px-2 transition-all duration-300 ${
              entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
            style={{ transitionDelay: `${60 + menuLinks.length * 45}ms` }}
          >
            <Link
              href="/login"
              onClick={onClose}
              className="inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-[#c27b3d] px-10 py-4 text-center text-base font-semibold text-white transition-colors hover:bg-[#a86a33] sm:w-auto sm:min-w-[16rem]"
            >
              Iniciar sesión
            </Link>
          </div>
        )}
      </nav>

      <footer className="mx-auto w-full max-w-[1280px] border-t border-black/10 px-6 py-6 md:px-10">
        <p className="text-center text-sm text-[#6b7280]">
          ComprameLaFoto · Comprá y descargá tus fotos digitales e impresas
        </p>
      </footer>
    </div>
  );
}

function MenuLink({
  href,
  children,
  onNavigate,
  accent,
  entered,
  delayMs,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  accent?: boolean;
  entered: boolean;
  delayMs: number;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`block py-1 text-center text-2xl font-semibold leading-tight tracking-tight transition-all duration-300 md:py-2 md:text-4xl ${
        entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${
        accent ? "text-[#a86a33] hover:text-[#c27b3d]" : "text-[#1a1a1a] hover:text-[#c27b3d]"
      }`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </Link>
  );
}
