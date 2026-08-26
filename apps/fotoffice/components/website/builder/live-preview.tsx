"use client";

import type { CSSProperties } from "react";
import type { WebsiteBlock } from "@/lib/website/blocks";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import { websiteDesignCssVars, type WebsiteDesignPresets } from "@/lib/website/design-presets";
import { deriveHomeNavItems } from "@/lib/website/navigation";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";
import { DEVICE_WIDTHS, type DeviceWidth } from "./device-toggle";

/**
 * Centro del builder: las MISMAS piezas que renderizan el sitio real (`WebsiteHeaderView` +
 * `WebsitePageRenderer`), alimentadas con el estado local del builder en vez de una consulta al
 * servidor — por eso reaccionan a cada tecla sin ida y vuelta a la DB. `/website/preview`
 * (servidor, autenticado) sigue existiendo aparte como "Vista externa": confirma que lo ya
 * guardado en el draft se ve igual fuera del builder.
 */
export function LivePreview({
  blocks,
  colors,
  designPresets,
  logoUrl,
  workspaceName,
  device,
}: {
  blocks: WebsiteBlock[];
  colors: WebsiteColors;
  designPresets: WebsiteDesignPresets;
  logoUrl: string | null;
  workspaceName: string;
  device: DeviceWidth;
}) {
  const navItems = deriveHomeNavItems(blocks);
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
    ...websiteDesignCssVars(designPresets),
  } as CSSProperties;

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-[var(--fo-border-muted)] p-6">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-[var(--fo-border)] bg-white shadow-sm transition-[max-width] duration-200"
        style={{ maxWidth: DEVICE_WIDTHS[device], ...themeVars }}
      >
        <WebsiteHeaderView logoUrl={logoUrl} workspaceName={workspaceName} navItems={navItems} designPresets={designPresets} />
        <WebsitePageRenderer blocks={blocks} colors={colors} designPresets={designPresets} />
      </div>
    </div>
  );
}
