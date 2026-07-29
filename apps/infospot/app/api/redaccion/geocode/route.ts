import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import {
  getInfoSpotMembership,
  toPermissionSubject,
  canEditInfoSpotArticle,
  canEditInfoSpotEvent,
  canModerateInfoSpotEvents,
} from "@/lib/infospot-access";
import {
  reverseGeocodeCoordinates,
  searchEventLocations,
} from "@/lib/geolocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z.object({
  q: z.string().trim().min(3).max(200),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
});

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/**
 * GET /api/redaccion/geocode?q=...
 * GET /api/redaccion/geocode?mode=reverse&lat=...&lon=...
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  const canEdit =
    canEditInfoSpotArticle(subject) ||
    canEditInfoSpotEvent(subject) ||
    canModerateInfoSpotEvents(subject);
  if (!canEdit) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  try {
    if (mode === "reverse") {
      const parsed = reverseSchema.safeParse({
        lat: req.nextUrl.searchParams.get("lat"),
        lon: req.nextUrl.searchParams.get("lon"),
      });
      if (!parsed.success) {
        return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
      }
      const result = await reverseGeocodeCoordinates(parsed.data.lat, parsed.data.lon);
      return NextResponse.json({ result });
    }

    const parsed = searchSchema.safeParse({
      q: req.nextUrl.searchParams.get("q"),
      city: req.nextUrl.searchParams.get("city") || undefined,
      province: req.nextUrl.searchParams.get("province") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetro q requerido (mín. 3)" }, { status: 400 });
    }

    const results = await searchEventLocations(parsed.data.q, {
      countryCode: "ar",
      city: parsed.data.city,
      province: parsed.data.province,
      limit: 5,
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Geocodificación no disponible" }, { status: 502 });
  }
}
