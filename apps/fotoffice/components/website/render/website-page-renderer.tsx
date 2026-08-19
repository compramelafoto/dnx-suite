import type { CSSProperties } from "react";
import type { WebsitePageContent } from "@/lib/website/blocks";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import { BlockErrorBoundary } from "./block-error-boundary";
import { WebsiteBlockRenderer } from "./website-block-renderer";

/**
 * Renderer real de una página de `WebsiteSections`: recibe los bloques de una página y los
 * renderiza en orden. `WebsitePageRenderer → WebsiteBlockRenderer → <Tipo>BlockView`.
 * Extensible: un bloque nuevo se agrega al registro de `WebsiteBlockRenderer`, nunca acá.
 */
export function WebsitePageRenderer({ blocks, colors }: { blocks: WebsitePageContent; colors: WebsiteColors }) {
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
  } as CSSProperties;

  const ordered = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <div style={{ ...themeVars, backgroundColor: "var(--wsite-bg)" }}>
      {ordered.length === 0 ? (
        <div className="px-6 py-24 text-center opacity-50" style={{ color: "var(--wsite-text)" }}>
          Esta página todavía no tiene secciones.
        </div>
      ) : (
        ordered.map((block) => (
          <BlockErrorBoundary key={block.id}>
            <WebsiteBlockRenderer block={block} />
          </BlockErrorBoundary>
        ))
      )}
    </div>
  );
}
