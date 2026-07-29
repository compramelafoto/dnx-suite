/**
 * Validación de parámetros del feed (servidor).
 */

import { z } from "zod";
import { FEED_CONFIG } from "./config";
import { INFO_SPOT_FEED_ITEM_TYPES, type FeedLocationMode, type InfoSpotFeedItemType } from "./types";

export const feedQuerySchema = z.object({
  lat: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),
  lng: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),
  cursor: z.string().max(500).optional().nullable(),
  limit: z.number().int().min(1).max(FEED_CONFIG.page.maxLimit).optional(),
  types: z.array(z.enum(INFO_SPOT_FEED_ITEM_TYPES)).optional(),
  radiusKm: z.number().min(5).max(500).optional().nullable(),
  locationMode: z
    .enum(["none", "gps", "manual", "national"])
    .optional(),
});

export type ParsedFeedQuery = z.infer<typeof feedQuerySchema>;

export function parseFeedSearchParams(params: URLSearchParams): {
  ok: true;
  data: {
    lat: number | null;
    lng: number | null;
    cursor: string | null;
    limit: number;
    types: InfoSpotFeedItemType[] | undefined;
    radiusKm: number | null;
    locationMode: FeedLocationMode;
  };
} | { ok: false; error: string } {
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  const limitRaw = params.get("limit");
  const radiusRaw = params.get("radiusKm");
  const typesRaw = params.get("types");
  const locationModeRaw = params.get("locationMode") || "none";

  const lat = latRaw == null || latRaw === "" ? null : Number(latRaw);
  const lng = lngRaw == null || lngRaw === "" ? null : Number(lngRaw);
  const limit = limitRaw == null || limitRaw === "" ? FEED_CONFIG.page.defaultLimit : Number(limitRaw);
  const radiusKm =
    radiusRaw == null || radiusRaw === "" ? null : Number(radiusRaw);

  let types: InfoSpotFeedItemType[] | undefined;
  if (typesRaw) {
    types = typesRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t): t is InfoSpotFeedItemType =>
        (INFO_SPOT_FEED_ITEM_TYPES as readonly string[]).includes(t),
      );
  }

  const parsed = feedQuerySchema.safeParse({
    lat,
    lng,
    cursor: params.get("cursor"),
    limit: Number.isFinite(limit) ? Math.trunc(limit) : undefined,
    types,
    radiusKm,
    locationMode: locationModeRaw,
  });

  if (!parsed.success) {
    return { ok: false, error: "Parámetros inválidos." };
  }

  const data = parsed.data;
  const hasLat = data.lat != null;
  const hasLng = data.lng != null;
  if (hasLat !== hasLng) {
    return { ok: false, error: "lat y lng deben enviarse juntos." };
  }
  if (data.lat === 0 && data.lng === 0) {
    return { ok: false, error: "Coordenadas 0,0 no son válidas." };
  }

  return {
    ok: true,
    data: {
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      cursor: data.cursor ?? null,
      limit: data.limit ?? FEED_CONFIG.page.defaultLimit,
      types: data.types,
      radiusKm: data.radiusKm ?? null,
      locationMode: (data.locationMode ?? "none") as FeedLocationMode,
    },
  };
}
