import type { ComponentType } from "react";
import { websiteBlockSchema, type WebsiteBlockType } from "@/lib/website/blocks";
import { WEBSITE_BLOCK_REGISTRY } from "@/lib/website/block-registry";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";

/**
 * Qué parte de los datos dinámicos usa cada tipo de bloque. Varias vistas son componentes de
 * cliente: lo que reciben viaja serializado al navegador, así que a cada una se le pasa sólo su
 * parte y no los datos de los demás bloques. Los tipos que no figuran no usan datos.
 */
const DATA_KEY_BY_TYPE: Partial<Record<WebsiteBlockType, keyof WebsiteDynamicData>> = {
  HERO: "heroBlog",
  BLOG_LATEST: "blogLatest",
  MEMBER_OF_WEEK: "memberOfWeek",
  CONTACT: "contact",
  INQUIRY_FORM: "inquiry",
  PORTFOLIO: "portfolio",
  TESTIMONIALS: "testimonios",
};

/** `undefined` se conserva: las vistas lo usan para saber que están en la vista previa del builder. */
function dataForBlock(type: WebsiteBlockType, data: WebsiteDynamicData | undefined): WebsiteDynamicData | undefined {
  if (data === undefined) return undefined;
  const key = DATA_KEY_BY_TYPE[type];
  return key ? { [key]: data[key] } : {};
}

/**
 * Despacha un bloque a su componente de renderizado. Fail-safe de forma: si el bloque no
 * matchea el schema vigente (dato corrupto, versión vieja, tipo desconocido de una etapa futura
 * no desplegada todavía acá), se omite en silencio. Fail-safe de runtime (un `View` que tira una
 * excepción al renderizar) es responsabilidad de `BlockErrorBoundary`, que envuelve cada llamada
 * a este componente en `WebsitePageRenderer` — un try/catch acá no serviría, porque el render de
 * `View` ocurre en la fase de reconciliación de React, no al construir el elemento JSX.
 */
export function WebsiteBlockRenderer({ block, data }: { block: unknown; data?: WebsiteDynamicData }) {
  const parsed = websiteBlockSchema.safeParse(block);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[WebsiteBlockRenderer] bloque inválido, omitido:", parsed.error.flatten());
    }
    return null;
  }
  const validBlock = parsed.data;
  if (!validBlock.visible) return null;

  const View = WEBSITE_BLOCK_REGISTRY[validBlock.type].View as ComponentType<{
    config: typeof validBlock.config;
    blockId?: string;
    data?: WebsiteDynamicData;
  }>;
  return <View config={validBlock.config} blockId={validBlock.id} data={dataForBlock(validBlock.type, data)} />;
}
