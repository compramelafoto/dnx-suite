import { cache } from "react";
import { prisma } from "@repo/db";
import { parseWebsiteSections, type WebsiteBlock } from "./blocks";
import { resolveWebsiteColors, type WebsiteColors } from "./branding-defaults";
import { parseWebsiteDesignPresets, type WebsiteDesignPresets } from "./design-presets";
import { WEBSITE_MODULE_KEY } from "./constants";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";

/**
 * Qué ve el visitante en la portada, según la tabla de la sección 4 del spec. Es la única
 * decisión de esta carpeta que puede romper lo que hoy funciona, así que vive separada de la
 * consulta para poder probarla entera.
 *
 * Regla: sin módulo habilitado, o sin versión publicada, NO hay sitio — la portada cae a la
 * landing de presupuesto de siempre, que es lo que hay hoy en producción.
 */
export function pickPublishedHomeBlocks(args: {
  websiteModuleEnabled: boolean;
  publishedSectionsJson: unknown;
}): { homeBlocks: WebsiteBlock[]; hasPublishedSite: boolean } {
  if (!args.websiteModuleEnabled || args.publishedSectionsJson == null) {
    return { homeBlocks: [], hasPublishedSite: false };
  }
  // parseWebsiteSections es tolerante: un JSON corrupto devuelve `{ pages: { home: [] } }` y una
  // sección inválida se descarta sola. Un sitio publicado con contenido roto se ve vacío, nunca
  // tira la página.
  const sections = parseWebsiteSections(args.publishedSectionsJson);
  return { homeBlocks: sections.pages.home ?? [], hasPublishedSite: true };
}

export type PublicSiteContact = {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  province: string | null;
  /** Texto plano institucional para el pie. NUNCA es HTML: se escapa al renderizar. */
  legalNote: string | null;
};

export type PublicSite = {
  workspaceId: string;
  workspaceSlug: string;
  commercialName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: WebsiteColors;
  designPresets: WebsiteDesignPresets;
  homeBlocks: WebsiteBlock[];
  hasPublishedSite: boolean;
  enabledModuleKeys: Set<string>;
  contact: PublicSiteContact;
};

/**
 * Todo lo que el armazón público necesita, en una sola pasada. Lo llama el layout de
 * `/w/[workspaceSlug]`, así cada página no vuelve a resolver lo mismo.
 *
 * PÚBLICA de verdad: no pide sesión ni usa `requireWebsiteContext` (eso es del panel y
 * redirige a /dashboard). Devuelve `null` si el slug no existe — quien llama hace notFound().
 *
 * Privacidad: el `select` es explícito y acotado. Nunca devolver el branding entero ni nada
 * de otro módulo: lo que salga de acá termina en el HTML que ve cualquiera.
 *
 * Envuelta en `cache()` de React: en la próxima etapa el layout de `/w/[workspaceSlug]` y su
 * página de inicio van a llamarla en el mismo request (un layout no le puede pasar datos a su
 * página en Next), y Prisma no deduplica esas llamadas por su cuenta. `cache()` deduplica por
 * request sin que ningún llamador se entere.
 */
export const loadPublicSite = cache(async function loadPublicSite(workspaceSlug: string): Promise<PublicSite | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: {
      workspaceId: true,
      commercialName: true,
      logoUrl: true,
      faviconUrl: true,
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      textColor: true,
      accentColor: true,
      contactEmail: true,
      phone: true,
      whatsapp: true,
      instagram: true,
      city: true,
      province: true,
      emailSignatureNote: true,
    },
  });
  if (!branding) return null;

  const [enabledModuleKeys, website] = await Promise.all([
    getEnabledModuleKeysForWorkspace(branding.workspaceId),
    prisma.fotofficeWorkspaceWebsite.findUnique({
      where: { workspaceId: branding.workspaceId },
      select: {
        publishedVersion: { select: { sectionsJson: true, designPresetsJson: true } },
      },
    }),
  ]);

  const websiteModuleEnabled = enabledModuleKeys.has(WEBSITE_MODULE_KEY);
  const { homeBlocks, hasPublishedSite } = pickPublishedHomeBlocks({
    websiteModuleEnabled,
    publishedSectionsJson: website?.publishedVersion?.sectionsJson ?? null,
  });

  return {
    workspaceId: branding.workspaceId,
    workspaceSlug,
    commercialName: branding.commercialName,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    colors: resolveWebsiteColors(branding),
    // El diseño se congela por versión: se lee el de la versión publicada, no el del borrador.
    designPresets: parseWebsiteDesignPresets(website?.publishedVersion?.designPresetsJson ?? null),
    homeBlocks,
    hasPublishedSite,
    enabledModuleKeys,
    contact: {
      email: branding.contactEmail,
      phone: branding.phone,
      whatsapp: branding.whatsapp,
      instagram: branding.instagram,
      city: branding.city,
      province: branding.province,
      legalNote: branding.emailSignatureNote,
    },
  };
});
