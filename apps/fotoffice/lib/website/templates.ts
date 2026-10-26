import { PLANTILLA_EVENTOS } from "./templates/eventos";
import { PLANTILLA_ESTUDIO } from "./templates/estudio";
import { PLANTILLA_RETRATO_EDITORIAL } from "./templates/retrato-editorial";
import { PLANTILLA_OSCURA } from "./templates/oscura";
import { PLANTILLA_INSTITUCION } from "./templates/institucion";
import { SITE_TEMPLATE_IDS, type SiteTemplate, type SiteTemplateId } from "./templates/tipos";

/**
 * Índice de plantillas del sitio. Cada una vive en `templates/<id>.ts` (el contrato está en
 * `templates/tipos.ts`) y es un sitio completo de muestra: diseño + páginas + bloques + menú.
 * Aplicarla es trabajo de `aplicarPlantilla` (`apply-template.ts`), que nunca pisa ni borra
 * contenido del usuario.
 *
 * `recommendedFor` usa los tipos de organización reales (`onboarding-constants`): es una
 * recomendación, nunca una restricción — toda plantilla queda disponible para cualquiera.
 */
export { SITE_TEMPLATE_IDS };
export type { SiteTemplate, SiteTemplateId, SiteTemplatePage } from "./templates/tipos";

export const WEBSITE_TEMPLATES: SiteTemplate[] = [
  PLANTILLA_EVENTOS,
  PLANTILLA_ESTUDIO,
  PLANTILLA_RETRATO_EDITORIAL,
  PLANTILLA_OSCURA,
  PLANTILLA_INSTITUCION,
];

/** Las tres plantillas de antes siguen resolviendo: hay sitios que guardaron su id. */
const ALIAS_VIEJOS: Record<string, SiteTemplateId> = {
  institucional: "institucion",
  fotografica: "eventos",
  minimal: "retrato-editorial",
};

/** El id vigente para un id guardado (actual o viejo), o `null` si no corresponde a ninguna. */
export function resolveTemplateId(id: string): SiteTemplateId | null {
  if ((SITE_TEMPLATE_IDS as readonly string[]).includes(id)) return id as SiteTemplateId;
  return Object.hasOwn(ALIAS_VIEJOS, id) ? ALIAS_VIEJOS[id] : null;
}

export function getWebsiteTemplate(id: string): SiteTemplate | undefined {
  const vigente = resolveTemplateId(id);
  return vigente ? WEBSITE_TEMPLATES.find((t) => t.id === vigente) : undefined;
}

/** Las fotos de muestra que usa la plantilla (sin repetir, en orden de aparición): las toman los
 * trabajos de muestra de la vista previa. */
export function fotosDeLaPlantilla(plantilla: SiteTemplate): string[] {
  const fotos = new Set<string>();
  for (const pagina of plantilla.paginas) {
    for (const b of pagina.bloques) {
      if (b.type === "HERO") b.config.slides.forEach((s) => s.imageUrl && fotos.add(s.imageUrl));
      else if (b.type === "IMAGE" && b.config.imageUrl) fotos.add(b.config.imageUrl);
      else if (b.type === "GALLERY") b.config.photos.forEach((p) => fotos.add(p.url));
    }
  }
  return [...fotos];
}
