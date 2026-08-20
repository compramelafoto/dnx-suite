import type { CSSProperties } from "react";
import type { WebsitePageContent } from "@/lib/website/blocks";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import { DEFAULT_DESIGN_PRESETS, websiteDesignCssVars, type WebsiteDesignPresets } from "@/lib/website/design-presets";
import { anchorMapForBlocks } from "@/lib/website/navigation";
import { BlockErrorBoundary } from "./block-error-boundary";
import { WebsiteBlockRenderer } from "./website-block-renderer";

/**
 * Renderer real de una página de `WebsiteSections`: recibe los bloques de una página y los
 * renderiza en orden. `WebsitePageRenderer → WebsiteBlockRenderer → <Tipo>BlockView`.
 * Extensible: un bloque nuevo se agrega al registro de `WebsiteBlockRenderer`, nunca acá.
 *
 * `designPresets` es opcional (default = `DEFAULT_DESIGN_PRESETS`) para no romper ningún caller
 * viejo — pero todo caller nuevo debería pasarlo explícitamente.
 */
export function WebsitePageRenderer({
  blocks,
  colors,
  designPresets = DEFAULT_DESIGN_PRESETS,
}: {
  blocks: WebsitePageContent;
  colors: WebsiteColors;
  designPresets?: WebsiteDesignPresets;
}) {
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
    ...websiteDesignCssVars(designPresets),
  } as CSSProperties;

  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  const animationClass =
    designPresets.animationPreset === "none" ? "" : designPresets.animationPreset === "soft" ? "wsite-anim-soft" : "wsite-anim-dynamic";
  const anchors = anchorMapForBlocks(blocks);

  return (
    <div
      style={{
        ...themeVars,
        backgroundColor: "var(--wsite-bg)",
        color: "var(--wsite-text)",
        fontFamily: "var(--wsite-body-font)",
        lineHeight: "var(--wsite-line-height)",
      }}
    >
      {ordered.length === 0 ? (
        <div className="px-6 py-24 text-center opacity-50" style={{ color: "var(--wsite-text)" }}>
          Esta página todavía no tiene secciones.
        </div>
      ) : (
        ordered.map((block, i) => (
          <BlockErrorBoundary key={block.id}>
            <div
              id={anchors.get(block.id)}
              className={animationClass}
              style={animationClass ? { animationDelay: `${Math.min(i, 5) * 80}ms` } : undefined}
            >
              <WebsiteBlockRenderer block={block} />
            </div>
          </BlockErrorBoundary>
        ))
      )}
    </div>
  );
}
