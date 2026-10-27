import { z } from "zod";
import { websitePageKeySchema, type WebsiteSections } from "./blocks";
import { isHttpsUrl } from "./contact";

/**
 * Ajustes por página propia (Sitio web → Ajustes): imagen al compartir y "ocultar de buscadores".
 * Viven en `sectionsJson.pageMeta[clave]`, junto al título y la dirección de la página. El inicio
 * no tiene meta: usa los ajustes generales del sitio.
 */
export type PageSettingsInput = Record<string, { shareImageUrl: string | null; hideFromSearch: boolean }>;

/** Estricto: lo que manda el panel. Un enlace que no es https se rechaza, no se corrige. */
export const pageSettingsInputSchema = z.record(
  websitePageKeySchema,
  z.object({
    shareImageUrl: z
      .string()
      .max(2000)
      .nullable()
      .transform((v) => v?.trim() || null)
      .refine((v) => v === null || isHttpsUrl(v)),
    hideFromSearch: z.boolean(),
  }),
);

/** Aplica los ajustes sobre las páginas que existen; una clave desconocida se ignora. */
export function applyPageSettings(sections: WebsiteSections, input: PageSettingsInput): WebsiteSections {
  const pageMeta = { ...sections.pageMeta };
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(pageMeta, key)) continue;
    const { shareImageUrl: _img, hideFromSearch: _hide, ...rest } = pageMeta[key];
    void _img;
    void _hide;
    pageMeta[key] = {
      ...rest,
      ...(value.shareImageUrl ? { shareImageUrl: value.shareImageUrl } : {}),
      ...(value.hideFromSearch ? { hideFromSearch: true } : {}),
    };
  }
  return { ...sections, pageMeta };
}
