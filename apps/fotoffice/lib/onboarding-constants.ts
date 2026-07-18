export const FOTOFFICE_ACTIVITY_TYPES = [
  { id: "independent", label: "Fotógrafo independiente" },
  { id: "studio", label: "Estudio fotográfico" },
  { id: "agency", label: "Equipo o agencia" },
] as const;

export type FotofficeActivityTypeId = (typeof FOTOFFICE_ACTIVITY_TYPES)[number]["id"];

export const FOTOFFICE_SPECIALTIES = [
  { id: "social_events", label: "Eventos sociales" },
  { id: "weddings", label: "Bodas" },
  { id: "birthdays", label: "Cumpleaños" },
  { id: "school", label: "Fotografía escolar" },
  { id: "sports", label: "Deportes" },
  { id: "press", label: "Prensa" },
  { id: "product", label: "Producto" },
  { id: "gastronomy", label: "Gastronomía" },
  { id: "portraits", label: "Retratos" },
  { id: "fashion", label: "Moda" },
  { id: "real_estate", label: "Inmobiliaria" },
  { id: "corporate", label: "Institucional" },
  { id: "other", label: "Otra" },
] as const;

export type FotofficeSpecialtyId = (typeof FOTOFFICE_SPECIALTIES)[number]["id"];

export const FOTOFFICE_SPECIALTY_IDS = new Set(
  FOTOFFICE_SPECIALTIES.map((s) => s.id),
);
