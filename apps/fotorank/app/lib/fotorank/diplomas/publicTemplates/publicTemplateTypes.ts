import type { DiplomaLayoutJson } from "../layoutSchema";

export type PublicTemplateFamily =
  | "clasico"
  | "premium"
  | "moderno"
  | "modern-decorative"
  | "artistico"
  | "vintage"
  | "workshop"
  | "participacion"
  | "fotografia"
  | "institucional"
  | "corporativo"
  | "minimal";

export type PublicTemplateStyleTag =
  | "clasico"
  | "minimal"
  | "oscuro"
  | "academico"
  | "artistico"
  | "corporativo"
  | "gala"
  | "vintage"
  | "editorial"
  | "ornamental"
  | "internacional"
  | "vertical"
  | "horizontal"
  | "nombre"
  | "premio"
  | "blanco-dorado"
  | "negro-dorado"
  | "azul"
  | "beige"
  | "neutro"
  | "workshop"
  | "participacion"
  | "fotografia"
  | "institucional"
  | "reconocimiento"
  | "premium"
  | "moderno"
  | "decorativo"
  | "creativo"
  | "colorido"
  | "geometrico"
  | "soft";

export type PublicTemplateMeta = {
  id: string;
  slug: string;
  name: string;
  description: string;
  family: PublicTemplateFamily;
  keywords: string[];
  styleTags: PublicTemplateStyleTag[];
  accentColor: string;
  /** Uso recomendado (filtros / futura UI). */
  recommendedUse?: string;
  /** Descripción corta de paleta (p. ej. crema + terracota). */
  paletteHint?: string;
  /** Formalidad percibida. */
  formalityLevel?: "bajo" | "medio" | "alto";
};

export type PublicTemplateBundle = PublicTemplateMeta & {
  backgroundColor: string;
  layout: DiplomaLayoutJson;
};

export type RawPublicTemplate = Omit<PublicTemplateBundle, "slug" | "family" | "keywords"> & {
  slug?: string;
  family?: PublicTemplateFamily;
  keywords?: string[];
};
