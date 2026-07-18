export type VisualNiche =
  | "bodas"
  | "cumpleaños de quince"
  | "eventos sociales"
  | "fotografía deportiva"
  | "fotografía escolar"
  | "recitales"
  | "retratos"
  | "familia"
  | "producto"
  | "gastronomía"
  | "inmobiliaria"
  | "corporativa";

export type VisualReferenceIntent = {
  requested: boolean;
  niche?: VisualNiche;
  confidence: number;
  sourceMessage: string;
};
