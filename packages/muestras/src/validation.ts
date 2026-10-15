import { MAX_HIGHLIGHTS, MAX_WORKS, isActivityType, type ActivityType } from "./constants";

export type DraftInput = {
  type: ActivityType | string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  organizersText: string;
  startDay: string;
  endDay: string;
  scheduleText: string | null;
  isVirtualOnly: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rightsConfirmed: boolean;
  worksCount: number;
  highlightsCount: number;
};

const blank = (s: string | null | undefined) => !s || s.trim() === "";

/** Una muestra se visita en persona: sin sede no hay muestra. Charlas o talleres sí pueden ser online. */
export const MUESTRA_NEEDS_VENUE = "Una muestra necesita una sede: cargá la dirección donde se puede visitar.";

/** Lo que falta para poder mandar a revisión. Lista vacía = lista para enviar. */
export function missingForSubmission(d: DraftInput): string[] {
  const out: string[] = [];
  if (!isActivityType(d.type)) out.push("Elegí el tipo de actividad.");
  if (blank(d.title)) out.push("Falta el título.");
  if (blank(d.description)) out.push("Falta la descripción.");
  if (blank(d.coverImageUrl)) out.push("Falta la foto de portada.");
  if (blank(d.organizersText)) out.push("Faltan los organizadores.");
  if (blank(d.startDay) || blank(d.endDay)) out.push("Faltan las fechas.");
  else if (d.endDay < d.startDay) out.push("La fecha de cierre es anterior a la de inicio.");
  if (blank(d.scheduleText)) out.push("Faltan los horarios.");
  if (d.type === "MUESTRA" && d.isVirtualOnly) out.push(MUESTRA_NEEDS_VENUE);
  else if (!d.isVirtualOnly) {
    if (blank(d.address)) out.push("Falta la dirección.");
    if (d.latitude == null || d.longitude == null) out.push("Falta ubicar el lugar en el mapa.");
  }
  if (d.type === "MUESTRA") {
    if (d.worksCount < 1) out.push("Una muestra necesita al menos una obra en la galería.");
    if (!d.rightsConfirmed) out.push("Falta confirmar que tenés autorización de los autores.");
  }
  if (d.worksCount > MAX_WORKS) out.push(`La galería admite hasta ${MAX_WORKS} obras.`);
  if (d.highlightsCount > MAX_HIGHLIGHTS) out.push(`Podés destacar hasta ${MAX_HIGHLIGHTS} obras.`);
  return out;
}
