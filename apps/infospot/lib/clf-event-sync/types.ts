/**
 * Tipos del sync inbound CLF Event → InfoSpotEvent.
 */

export const CLF_EVENT_VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export type ClfEventVisibility = (typeof CLF_EVENT_VISIBILITIES)[number];

export const CLF_EVENT_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type ClfEventStatus = (typeof CLF_EVENT_STATUSES)[number];

export const CLF_JOIN_POLICIES = ["OPEN", "REQUEST", "INVITE_ONLY"] as const;
export type ClfJoinPolicy = (typeof CLF_JOIN_POLICIES)[number];

/** Todos los EventType del schema Prisma (exhaustivo). */
export const CLF_EVENT_TYPES = [
  "WEDDING",
  "BIRTHDAY",
  "GRADUATION",
  "SPORTS",
  "CONCERT",
  "CORPORATE",
  "OTHER",
  "PUBLIC_SESSION",
  "PRIVATE_SESSION",
  "PUBLIC_PHOTOGRAPHY",
  "THEMATIC_SESSIONS",
  "COMMERCIAL_SESSIONS",
  "SCHOOL",
  "RELIGIOUS",
  "FESTIVAL",
  "CONFERENCE",
] as const;
export type ClfEventType = (typeof CLF_EVENT_TYPES)[number];

export type ClfEventForSync = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: Date;
  endsAt: Date | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  city: string;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  shareSlug: string | null;
  coverImageKey: string | null;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  creator: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    website: string | null;
    city: string | null;
    province: string | null;
    companyName: string | null;
  };
  /** Miembros ACTIVE con rol PHOTOGRAPHER (si se consultó). */
  activePhotographerCount?: number;
};

export type SyncWarning = {
  code: string;
  message: string;
};

export type SyncChange = string;

export type SyncClfEventResult =
  | {
      ok: true;
      action: "created" | "updated" | "unchanged" | "skipped" | "stale";
      clfEventId: number;
      infoSpotEventId: string | null;
      originId: string | null;
      changes: SyncChange[];
      warnings: SyncWarning[];
      dryRun: boolean;
      message: string;
    }
  | {
      ok: false;
      action: "failed" | "skipped";
      clfEventId: number;
      infoSpotEventId: string | null;
      originId: string | null;
      changes: SyncChange[];
      warnings: SyncWarning[];
      dryRun: boolean;
      error: string;
    };

export type ReconcileSummary = {
  dryRun: boolean;
  scanned: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  stale: number;
  failed: number;
  results: SyncClfEventResult[];
};
