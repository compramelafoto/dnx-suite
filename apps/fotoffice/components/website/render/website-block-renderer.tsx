import type { ComponentType } from "react";
import { websiteBlockSchema } from "@/lib/website/blocks";
import { WEBSITE_BLOCK_REGISTRY } from "@/lib/website/block-registry";

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

  const View = WEBSITE_BLOCK_REGISTRY[validBlock.type].View as ComponentType<{ config: typeof validBlock.config; blockId?: string }>;
  return <View config={validBlock.config} blockId={validBlock.id} />;
}
