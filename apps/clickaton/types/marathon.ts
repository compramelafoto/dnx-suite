/**
 * Modelo estructural público de maratón — contrato Clickaton (pre-FotoRank).
 * Independiente de Prisma. No copiar el modelo interno de FotoRank.
 *
 * Etapa 05A: `PublicMarathon` permanece como ficha estructural.
 * Contratos satélite (inscripción, cupos, resultados, galería, etc.):
 * `apps/clickaton/types/public/*` — importar desde `@/types/public`.
 *
 * Campos embebidos marcados como “transicional” coexisten con la UI actual
 * de Etapa 05; el consumo futuro preferirá contratos satélite por recurso.
 */

import type { PublicValidationRule } from "./public/validation";


export type MarathonStatus =
  | "draft"
  | "announced"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "judging"
  | "results_published"
  | "archived"
  | "cancelled";

export type RegistrationStatus =
  | "unavailable"
  | "coming_soon"
  | "open"
  | "last_places"
  | "full"
  | "closed"
  | "cancelled";

export type MarathonFormat = "individual" | "team" | "mixed";

export type AllowedDevice = "smartphone" | "camera" | "drone";

export type ResultsStatus =
  | "not_available"
  | "pending"
  | "partial"
  | "published"
  | "archived";

export type GalleryStatus =
  | "not_available"
  | "coming_soon"
  | "published"
  | "archived";

export type ChallengeStatus =
  | "scheduled"
  | "released"
  | "closed"
  | "hidden";

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
};

export type PublicOrganizer = {
  name: string;
  type: "club" | "association" | "institution" | "municipality" | "producer" | "other";
  description?: string;
  logo?: string;
  website?: string;
  city?: string;
  country?: string;
};

export type PublicVenue = {
  name: string;
  city: string;
  provinceOrRegion: string;
  country: string;
  coordinatorName?: string;
  description?: string;
};

export type PublicCategory = {
  id: string;
  name: string;
  description: string;
  allowedDevices: AllowedDevice[];
  ageRange?: string;
  capacity?: number;
};

export type PublicScheduleItem = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  location?: string;
  publicBeforeEvent: boolean;
  type: "briefing" | "start" | "checkpoint" | "deadline" | "ceremony" | "other";
};

export type PublicPrize = {
  id: string;
  title: string;
  description: string;
  position?: number;
  categoryId?: string;
  sponsorName?: string;
  image?: string;
};

export type PublicJuryMember = {
  id: string;
  name: string;
  role: string;
  biography?: string;
  portrait?: string;
  website?: string;
  socialLinks?: SocialLinks;
};

export type PublicSponsor = {
  id: string;
  name: string;
  level?: string;
  logo?: string;
  website?: string;
  description?: string;
  localOrGlobal: "local" | "global";
};

export type PublicFAQItem = {
  question: string;
  answer: string;
};

export type PublicRulesDocument = {
  title: string;
  summary: string;
  version: string;
  publishedAt?: string;
  effectiveAt?: string;
  documentUrl?: string;
  content?: string;
};

/**
 * Política pública de validaciones (resumen en ficha).
 * Detalle por regla: `PublicValidationRule` en `types/public/validation.ts`.
 */
export type PublicValidationPolicy = {
  timeWindowEnforced: boolean;
  gpsMayBeRequired: boolean;
  exifMayBeRequired: boolean;
  summary: string;
  notes?: string[];
  /** Lista opcional de reglas públicas tipadas (Etapa 05A). */
  rules?: PublicValidationRule[];
};

/**
 * Consigna pública. Puede permanecer oculta hasta releaseAt.
 * Nunca renderizar title/description si `revealed` es false o status !== "released".
 */
export type PublicChallenge = {
  id: string;
  order: number;
  title?: string;
  description?: string;
  status: ChallengeStatus;
  releaseAt?: string;
  submissionCloseAt?: string;
  revealed: boolean;
  publicAfterEvent: boolean;
  educationalGoal?: string;
};

/**
 * Ficha estructural pública de una edición.
 *
 * Incluye identidad, territorio, estados resumidos y contenido editorial
 * necesario para renderizar `/maratones/[slug]` sin consultas de usuario.
 *
 * No incluir acá:
 * - oferta/precios de inscripción → `PublicRegistrationOffer`
 * - elegibilidad de usuario → `RegistrationEligibility`
 * - inscripción del participante → `ParticipantRegistrationSummary`
 * - flags de acciones → `PublicMarathonCapabilities`
 * - cupos vivos → `PublicCapacity` / `PublicCategoryCapacity`
 * - ranking completo → `PublicMarathonResults`
 * - imágenes de galería → `PublicMarathonGallery`
 * - ventanas operativas finas → `PublicScheduleWindow`
 * - versionado de aceptación → `PublicRulesVersion`
 * - contingencias → `PublicEventNotice`
 */
export type PublicMarathon = {
  id: string;
  slug: string;
  name: string;
  editionName: string;
  shortDescription: string;
  fullDescription: string;
  status: MarathonStatus;
  registrationStatus: RegistrationStatus;
  format: MarathonFormat;
  modality: string;
  featured: boolean;
  /** Fixture técnico; no es una edición anunciada. */
  isDemo?: boolean;
  city: string;
  provinceOrRegion: string;
  country: string;
  venueName?: string;
  meetingPoint?: string;
  timezone: string;
  startAt: string;
  endAt: string;
  /** Transicional: preferir `PublicScheduleWindow` kind=registration. */
  registrationOpenAt?: string;
  /** Transicional: preferir `PublicScheduleWindow` kind=registration. */
  registrationCloseAt?: string;
  /** Bloque público de inscripción (09A). Preferir sobre flags sueltos. */
  registration?: import("./public/registration").PublicRegistrationSummary;
  /** Transicional: preferir `PublicCapacity.participantLimit`. */
  participantLimit?: number;
  minimumAge?: number;
  allowedDevices: AllowedDevice[];
  /** Portada local o futura URL firmada. Opcional — la UI usa fallback editorial. */
  coverImage?: string;
  /** Crédito de la portada si existe (nunca inventar). */
  coverImageCredit?: string;
  /** Transicional: preferir `PublicMarathonGallery` cuando exista payload. */
  galleryPreview: string[];
  organizer: PublicOrganizer;
  localVenue?: PublicVenue;
  categories: PublicCategory[];
  schedule: PublicScheduleItem[];
  /** Premios anunciados en ficha; awards adjudicados → `PublicMarathonResults`. */
  prizes: PublicPrize[];
  jury: PublicJuryMember[];
  sponsors: PublicSponsor[];
  faq: PublicFAQItem[];
  /** Transicional: preferir también `PublicRulesVersion` para aceptación/hash. */
  rules?: PublicRulesDocument;
  validationPolicy?: PublicValidationPolicy;
  accessibilityNotes?: string;
  contactInfo?: string;
  socialLinks?: SocialLinks;
  /** Resumen de estado; payload → `PublicMarathonResults`. */
  resultsStatus: ResultsStatus;
  /** Resumen de estado; payload → `PublicMarathonGallery`. */
  galleryStatus: GalleryStatus;
  /** Consignas: filtrar antes de UI (`lib/challenges.ts`). */
  challenges?: PublicChallenge[];
  createdAt: string;
  updatedAt: string;
};

/** Etiquetas de UI (es-AR) — no usar términos técnicos crudos. */
export const marathonStatusLabels: Record<MarathonStatus, string> = {
  draft: "Borrador",
  announced: "Anunciada",
  registration_open: "Inscripción abierta",
  registration_closed: "Inscripción cerrada",
  in_progress: "En curso",
  judging: "En evaluación",
  results_published: "Resultados publicados",
  archived: "Archivada",
  cancelled: "Cancelada",
};

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  unavailable: "No disponible",
  coming_soon: "Próximamente",
  open: "Abierta",
  last_places: "Últimos lugares",
  full: "Completa",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export const marathonFormatLabels: Record<MarathonFormat, string> = {
  individual: "Individual",
  team: "Grupal",
  mixed: "Mixta",
};

export const allowedDeviceLabels: Record<AllowedDevice, string> = {
  smartphone: "Celular",
  camera: "Cámara",
  drone: "Drone",
};

export const resultsStatusLabels: Record<ResultsStatus, string> = {
  not_available: "No disponibles",
  pending: "Pendientes",
  partial: "Parciales",
  published: "Publicados",
  archived: "Archivados",
};

export const galleryStatusLabels: Record<GalleryStatus, string> = {
  not_available: "No disponible",
  coming_soon: "Próximamente",
  published: "Publicada",
  archived: "Archivada",
};

export const challengeStatusLabels: Record<ChallengeStatus, string> = {
  scheduled: "Programada",
  released: "Liberada",
  closed: "Cerrada",
  hidden: "Oculta",
};

export const scheduleItemTypeLabels: Record<PublicScheduleItem["type"], string> = {
  briefing: "Briefing",
  start: "Inicio",
  checkpoint: "Punto de control",
  deadline: "Cierre de entrega",
  ceremony: "Ceremonia",
  other: "Actividad",
};

export const organizerTypeLabels: Record<PublicOrganizer["type"], string> = {
  club: "Club",
  association: "Asociación",
  institution: "Institución",
  municipality: "Municipio",
  producer: "Productora",
  other: "Organización",
};
