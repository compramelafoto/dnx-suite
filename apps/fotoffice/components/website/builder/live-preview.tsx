"use client";

import type { CSSProperties } from "react";
import type { WebsiteBlock } from "@/lib/website/blocks";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { websiteDesignCssVars, type WebsiteDesignPresets } from "@/lib/website/design-presets";
import { resolveSiteNav, toPreviewNav, type SiteMenu } from "@/lib/website/site-menu";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";
import { SiteFrame } from "@/components/website/render/site-frame";
import { DEVICE_WIDTHS, type DeviceWidth } from "./device-toggle";

/**
 * Centro del builder: las MISMAS piezas que renderizan el sitio real (`SiteFrame` +
 * `WebsiteHeaderView` + `WebsitePageRenderer`), alimentadas con el estado local del builder en
 * vez de una consulta al servidor — por eso reaccionan a cada tecla sin ida y vuelta a la DB.
 * `/website/preview` (servidor, autenticado) sigue existiendo aparte como "Vista externa".
 *
 * El recuadro del dispositivo tiene alto fijo y su propio scroll, y un `transform`: eso hace que
 * el menú desplegable (que es `position: fixed`) se abra dentro del recuadro y no tape el panel.
 */
export function LivePreview({
  blocks,
  colors,
  designPresets,
  menu,
  enabledModuleKeys,
  personVocabulary,
  logoUrl,
  workspaceName,
  device,
}: {
  blocks: WebsiteBlock[];
  colors: WebsiteColors;
  designPresets: WebsiteDesignPresets;
  menu: SiteMenu | null;
  enabledModuleKeys: ReadonlySet<string>;
  personVocabulary: PersonVocabulary;
  logoUrl: string | null;
  workspaceName: string;
  device: DeviceWidth;
}) {
  const navItems = toPreviewNav(
    resolveSiteNav({ workspaceSlug: "vista-previa", homeBlocks: blocks, enabledModuleKeys, hasPublishedSite: true, menu, personVocabulary }),
  );
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
    ...websiteDesignCssVars(designPresets),
  } as CSSProperties;

  return (
    <div className="flex h-full items-stretch justify-center bg-[var(--fo-border-muted)] p-6">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-[var(--fo-border)] bg-white shadow-sm transition-[max-width] duration-200"
        style={{ maxWidth: DEVICE_WIDTHS[device], transform: "translateZ(0)" }}
      >
        <div className="h-full overflow-y-auto" data-website-preview-scroll>
          <SiteFrame
            designPresets={designPresets}
            style={themeVars}
            minHeight="100%"
            header={
              <WebsiteHeaderView logoUrl={logoUrl} workspaceName={workspaceName} navItems={navItems} designPresets={designPresets} homeHref="#" loginHref="#" />
            }
          >
            <WebsitePageRenderer blocks={blocks} colors={colors} designPresets={designPresets} />
          </SiteFrame>
        </div>
      </div>
    </div>
  );
}
