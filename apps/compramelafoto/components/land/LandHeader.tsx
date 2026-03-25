"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PublicMarketingHeader } from "@repo/design-system/components/layout";
import { appShellHeader } from "@repo/design-system/tokens";
import ComprameLaFotoFullscreenMenu from "@/components/layout/ComprameLaFotoFullscreenMenu";

const shell = appShellHeader.comprameLaFotoPublic;

type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
} | null;

/**
 * Misma barra que el sitio público (FotoRank-style shell, colores ComprameLaFoto):
 * logo grande, CTA registro, menú terracota.
 */
export default function LandHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [directoryCounts, setDirectoryCounts] = useState<DirectoryCounts>(null);

  useEffect(() => {
    fetch("/api/public/directory/counts")
      .then((r) => r.json())
      .then((data) => {
        if (data?.photographers !== undefined && data?.labs !== undefined) {
          setDirectoryCounts({
            photographers: data.photographers,
            labs: data.labs,
            photographerServices: data.photographerServices ?? 0,
            eventVendors: data.eventVendors ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  const logoStyle: React.CSSProperties = {
    display: "block",
    height: shell.logoMaxHeight,
    width: "auto",
    maxWidth: shell.logoMaxWidth,
    objectFit: "contain",
    objectPosition: "left center",
  };

  return (
    <>
      <PublicMarketingHeader
        LinkComponent={Link}
        variant="comprameLaFotoLight"
        position="sticky"
        logo={
          <Link href="/" className="flex min-w-0 items-center justify-start" aria-label="ComprameLaFoto">
            <Image
              src="/LOGO CLF.png"
              alt="ComprameLaFoto"
              width={1024}
              height={220}
              style={logoStyle}
              priority
            />
          </Link>
        }
        showDashboardLink={false}
        dashboardHref="/"
        sessionControl={
          <Link
            href="/registro"
            className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-xl bg-[#c27b3d] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a86a33] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40"
          >
            Crear cuenta gratis
          </Link>
        }
        onMenuOpen={() => setMenuOpen(true)}
        menuAriaLabel="Abrir menú"
      />

      <ComprameLaFotoFullscreenMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        directoryCounts={directoryCounts}
        user={null}
        loading={false}
      />
    </>
  );
}
