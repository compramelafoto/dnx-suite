/**
 * Modelo funcional público de maratón — contrato Clickaton (pre-FotoRank).
 * Independiente de Prisma. No copiar el modelo interno de FotoRank.
 */

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
 * Consigna pública. Puede permanecer oculta hasta releaseAt.
 * No publicar consignas ficticias en la UI todavía.
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
  city: string;
  provinceOrRegion: string;
  country: string;
  venueName?: string;
  meetingPoint?: string;
  timezone: string;
  startAt: string;
  endAt: string;
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  participantLimit?: number;
  minimumAge?: number;
  allowedDevices: AllowedDevice[];
  coverImage?: string;
  galleryPreview: string[];
  organizer: PublicOrganizer;
  localVenue?: PublicVenue;
  categories: PublicCategory[];
  schedule: PublicScheduleItem[];
  prizes: PublicPrize[];
  jury: PublicJuryMember[];
  sponsors: PublicSponsor[];
  faq: PublicFAQItem[];
  rules?: PublicRulesDocument;
  accessibilityNotes?: string;
  contactInfo?: string;
  socialLinks?: SocialLinks;
  resultsStatus: ResultsStatus;
  galleryStatus: GalleryStatus;
  /** Consignas: contrato futuro; no exponer en UI hasta integración. */
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
