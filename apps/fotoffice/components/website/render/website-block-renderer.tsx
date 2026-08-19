import type { ComponentType } from "react";
import { websiteBlockSchema, type WebsiteBlock } from "@/lib/website/blocks";
import { HeroBlockView } from "./blocks/hero-block-view";
import { TextBlockView } from "./blocks/text-block-view";
import { ImageBlockView } from "./blocks/image-block-view";
import { CtaBlockView } from "./blocks/cta-block-view";
import { SpacerBlockView } from "./blocks/spacer-block-view";

/** Registro tipo→componente. Agregar un bloque nuevo es agregar una entrada acá, nunca un
 * switch nuevo desperdigado por la app. */
const BLOCK_VIEWS: { [K in WebsiteBlock["type"]]: ComponentType<{ config: Extract<WebsiteBlock, { type: K }>["config"] }> } = {
  HERO: HeroBlockView,
  TEXT: TextBlockView,
  IMAGE: ImageBlockView,
  CTA: CtaBlockView,
  SPACER: SpacerBlockView,
};

/**
 * Despacha un bloque a su componente de renderizado. Fail-safe de forma: si el bloque no
 * matchea el schema vigente (dato corrupto, versión vieja, tipo desconocido de una etapa futura
 * no desplegada todavía acá), se omite en silencio. Fail-safe de runtime (un `View` que tira una
 * excepción al renderizar) es responsabilidad de `BlockErrorBoundary`, que envuelve cada llamada
 * a este componente en `WebsitePageRenderer` — un try/catch acá no serviría, porque el render de
 * `View` ocurre en la fase de reconciliación de React, no al construir el elemento JSX.
 */
export function WebsiteBlockRenderer({ block }: { block: unknown }) {
  const parsed = websiteBlockSchema.safeParse(block);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[WebsiteBlockRenderer] bloque inválido, omitido:", parsed.error.flatten());
    }
    return null;
  }
  const validBlock = parsed.data;
  if (!validBlock.visible) return null;

  const View = BLOCK_VIEWS[validBlock.type] as ComponentType<{ config: typeof validBlock.config }>;
  return <View config={validBlock.config} />;
}
