"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import { isPhotographerPath } from "@/lib/photographer-slugs";

const AUTH_SHELL_PATHS = new Set([
  "/login",
  "/registro",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

function isAuthShellPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (AUTH_SHELL_PATHS.has(pathname)) return true;
  return pathname.startsWith("/registro/");
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPhotographerRoute = isPhotographerPath(pathname);
  const isLabPublicRoute = pathname?.startsWith("/l/");
  const isAlbumRoute = pathname?.startsWith("/a/");
  const isAlbumSlugPublicRoute = pathname?.startsWith("/album/");
  const isLabRoute = pathname?.startsWith("/lab/");
  const isFotografoPanelRoute = pathname?.startsWith("/fotografo/");
  const isDashboardPanelRoute = pathname?.startsWith("/dashboard/");
  const isOrganizadorPanelRoute = pathname?.startsWith("/organizador/");
  const isHomePreview = pathname === "/home-preview";
  const isDesignSystemRoute = pathname?.startsWith("/design-system");
  const isCamOfDutyRoute = pathname?.startsWith("/camofduty");
  const isAuthShell = isAuthShellPath(pathname);

  if (
    isHomePreview ||
    isDesignSystemRoute ||
    isCamOfDutyRoute ||
    isAuthShell ||
    isPhotographerRoute ||
    isLabPublicRoute ||
    isAlbumRoute ||
    isAlbumSlugPublicRoute ||
    isLabRoute ||
    isFotografoPanelRoute ||
    isDashboardPanelRoute ||
    isOrganizadorPanelRoute
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      <Header />
      <main className="w-full min-w-0 flex-1">{children}</main>
      {!isHomePreview && <Footer />}
    </div>
  );
}
