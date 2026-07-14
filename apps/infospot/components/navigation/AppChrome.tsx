"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import type { SiteHeaderAuth } from "@/components/navigation/HeaderAuthActions";
import type { HomeHeaderLink } from "@/lib/home-experience";
import { isRedaccionEditorPath } from "@/lib/redaccion-editor-routes";

type Props = {
  auth: SiteHeaderAuth | null;
  primaryCta?: HomeHeaderLink | null;
  secondaryLinks?: HomeHeaderLink[];
  children: ReactNode;
};

/**
 * Conditionally hides SiteHeader / SiteFooter on Redacción editor routes
 * so the shell can provide a focused writing chrome.
 */
export function AppChrome({
  auth,
  primaryCta = null,
  secondaryLinks = [],
  children,
}: Props) {
  const pathname = usePathname() ?? "";
  const hideChrome = isRedaccionEditorPath(pathname);

  return (
    <>
      {hideChrome ? null : (
        <SiteHeader
          auth={auth}
          primaryCta={primaryCta}
          secondaryLinks={secondaryLinks}
        />
      )}
      {children}
      {hideChrome ? null : <SiteFooter />}
    </>
  );
}
