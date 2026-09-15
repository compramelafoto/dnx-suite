/**
 * El perfil de colaborador: la llave del portal de esta etapa.
 *
 * `CoverageCollaboratorProfile` es 1:1 con `Member` (ver el modelo en `schema.prisma`): un
 * socio del padrón que además coordinación marcó como colaborador de coberturas. Sin ese
 * perfil, o con `active: false`, la persona no ve ninguna convocatoria — es la regla que
 * consume `puedePostularse` en `elegibilidad.ts` a través de `tienePerfilActivo`.
 *
 * En esta etapa solo se usan `active`, `homeCity` y `coverageZones` para algo (habilitar el
 * portal, ver el vocabulario del plan). El resto de los campos del modelo —equipo, radio,
 * especialidades, nivel de experiencia, si acepta urgencias— se editan y se guardan porque ya
 * existen en la base, pero ninguna lógica de esta tanda depende de ellos: quedan listos para
 * cuando la recomendación de candidatos (fuera de alcance acá) los necesite.
 *
 * Función pura, sin Prisma: el formulario se valida en el servidor, no en el `required` del
 * HTML.
 */

/** AUTO | MOTO | BICICLETA | TRANSPORTE_PUBLICO | A_PIE | OTRO, como en el modelo. */
export const TRANSPORT_OPTIONS = [
  "AUTO",
  "MOTO",
  "BICICLETA",
  "TRANSPORTE_PUBLICO",
  "A_PIE",
  "OTRO",
] as const;
export type TransportOption = (typeof TRANSPORT_OPTIONS)[number];

export const TRANSPORT_LABELS: Record<TransportOption, string> = {
  AUTO: "Auto",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  TRANSPORTE_PUBLICO: "Transporte público",
  A_PIE: "A pie",
  OTRO: "Otro",
};

/** INICIAL | INTERMEDIO | AVANZADO | PROFESIONAL, como en el modelo. */
export const EXPERIENCE_LEVELS = ["INICIAL", "INTERMEDIO", "AVANZADO", "PROFESIONAL"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  INICIAL: "Inicial",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
  PROFESIONAL: "Profesional",
};

/**
 * Tope del radio de traslado, en kilómetros.
 *
 * 300 alcanza y sobra para cualquier cobertura real dentro de una provincia: nadie viaja el
 * doble de esa distancia para una actividad solidaria, y un número sin techo en un campo que
 * hoy no alimenta ninguna regla es una forma fácil de terminar con un "999999" cargado por
 * error y sin que nada lo note.
 */
export const MAX_TRAVEL_KM_MIN = 0;
export const MAX_TRAVEL_KM_MAX = 300;

export type ParsedCollaboratorProfile = {
  active: boolean;
  homeCity: string | null;
  coverageZones: string[];
  maxTravelKm: number | null;
  transport: TransportOption | null;
  equipment: string[];
  specialties: string[];
  experienceLevel: ExperienceLevel | null;
  acceptsUrgent: boolean;
  notes: string | null;
};

function texto(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Una lista escrita "una por línea" o separada por comas, como ya hace `settings-form.tsx`. */
function lista(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function radioKm(v: string | undefined): number | null {
  const t = v?.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_TRAVEL_KM_MAX, Math.max(MAX_TRAVEL_KM_MIN, Math.round(n)));
}

function normalizarTransporte(v: string | undefined): TransportOption | null {
  return (TRANSPORT_OPTIONS as readonly string[]).includes(v ?? "")
    ? (v as TransportOption)
    : null;
}

function normalizarNivelExperiencia(v: string | undefined): ExperienceLevel | null {
  return (EXPERIENCE_LEVELS as readonly string[]).includes(v ?? "") ? (v as ExperienceLevel) : null;
}

/**
 * Parsea el formulario de perfil de colaborador.
 *
 * Sin campos obligatorios: dejar todo vacío es válido y significa "todavía no sabemos nada de
 * esta persona además de que existe en el padrón". Lo único que decide si participa del portal
 * es `active` (ver `perfilHabilitado` más abajo).
 */
export function parseCollaboratorProfileForm(form: Record<string, string>): ParsedCollaboratorProfile {
  return {
    active: form.active === "on",
    homeCity: texto(form.homeCity),
    coverageZones: lista(form.coverageZones),
    maxTravelKm: radioKm(form.maxTravelKm),
    transport: normalizarTransporte(form.transport),
    equipment: lista(form.equipment),
    specialties: lista(form.specialties),
    experienceLevel: normalizarNivelExperiencia(form.experienceLevel),
    acceptsUrgent: form.acceptsUrgent === "on",
    notes: texto(form.notes),
  };
}

/**
 * Si este perfil habilita a participar del portal de coberturas.
 *
 * Sin perfil (`null`/`undefined`, un socio que nunca se marcó como colaborador) o con el
 * perfil apagado, la persona no ve ninguna convocatoria. Este booleano es exactamente
 * `tienePerfilActivo` en `CandidatoAConvocatoria` (ver `elegibilidad.ts`): quien arme ese
 * objeto para llamar a `puedePostularse` tiene que resolverlo con esta función y no con un
 * chequeo suelto de `active` repetido en cada pantalla.
 */
export function perfilHabilitado(perfil: { active: boolean } | null | undefined): boolean {
  return perfil?.active === true;
}
