/**
 * Adaptador base COMPRAMELAFOTO.
 * No ejecuta importación masiva; solo normaliza identidades y payloads.
 */

import type { ContentSourceAdapter } from "./types";
import type { OperationalPayload, OriginExternalEntityType } from "../types";
import { normalizeExternalId } from "../types";

function clfPublicBase(): string {
  return (
    process.env.COMPRAMELAFOTO_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_COMPRAMELAFOTO_URL?.replace(/\/$/, "") ||
    "https://compramelafoto.com"
  );
}

export const comprameLaFotoAdapter: ContentSourceAdapter = {
  sourceType: "COMPRAMELAFOTO",
  defaultDirection: "INBOUND",

  normalizeIdentity({ externalEntityType, externalId }) {
    return {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType,
      externalId: normalizeExternalId(externalId),
    };
  },

  buildOperationalPayload(raw: unknown): OperationalPayload {
    if (!raw || typeof raw !== "object") return {};
    const r = raw as Record<string, unknown>;
    const payload: OperationalPayload = {};
    for (const key of [
      "title",
      "startsAt",
      "endsAt",
      "city",
      "locationName",
      "latitude",
      "longitude",
      "publicSlug",
      "isHidden",
      "isPublic",
      "deletedAt",
      "firstPhotoDate",
      "createdAt",
      "expirationExtensionDays",
      "cleanupStatus",
      "storagePurged",
      "photoCount",
      "albumCount",
      "joinPolicy",
      "maxPhotographers",
      "commercialStatus",
    ]) {
      if (key in r) payload[key] = r[key];
    }
    return payload;
  },

  resolveExternalUrl({ externalEntityType, externalId, payload }) {
    void externalId;
    const base = clfPublicBase();
    switch (externalEntityType as OriginExternalEntityType) {
      case "ALBUM": {
        const slug =
          typeof payload?.publicSlug === "string" ? payload.publicSlug : null;
        return slug ? `${base}/album/${slug}` : null;
      }
      case "EVENT": {
        const slug =
          typeof payload?.shareSlug === "string" ? payload.shareSlug : null;
        if (slug) return `${base}/e/${slug}`;
        return typeof payload?.publicUrl === "string" ? payload.publicUrl : null;
      }
      case "PHOTO":
        return typeof payload?.previewUrl === "string" ? payload.previewUrl : null;
      default:
        return null;
    }
  },

  async fetch() {
    // Importación masiva: etapa posterior.
    return [];
  },
};

export function normalizeClfExternalIdentity(
  entityType: OriginExternalEntityType,
  externalId: string | number,
) {
  return comprameLaFotoAdapter.normalizeIdentity({
    externalEntityType: entityType,
    externalId,
  });
}
