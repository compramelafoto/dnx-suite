import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getClfPublicOrigin,
} from "@/lib/clf-event-sync/urls";
import {
  incrementContentMetric,
  isSafeExternalRedirect,
} from "@/lib/distribution/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().url(),
  kind: z
    .enum([
      "CLF_REGISTRATION_CLICK",
      "EVENT_CLICK",
      "ALBUM_CLICK",
      "PURCHASE_CLICK",
    ])
    .default("CLF_REGISTRATION_CLICK"),
  eventId: z.string().optional(),
  articleId: z.string().optional(),
});

/**
 * GET /api/r?to=...&kind=...&eventId=...
 * Registra clic y redirige. Nunca bloquea al usuario si falla el tracking.
 */
export async function GET(req: NextRequest) {
  const parsed = schema.safeParse({
    to: req.nextUrl.searchParams.get("to"),
    kind: req.nextUrl.searchParams.get("kind") || "CLF_REGISTRATION_CLICK",
    eventId: req.nextUrl.searchParams.get("eventId") || undefined,
    articleId: req.nextUrl.searchParams.get("articleId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const allowed = [getClfPublicOrigin()];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && /^https?:\/\//i.test(appUrl)) {
    try {
      allowed.push(new URL(appUrl).origin);
    } catch {
      /* ignore */
    }
  }

  if (!isSafeExternalRedirect(parsed.data.to, allowed)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    await incrementContentMetric({
      kind: parsed.data.kind,
      eventId: parsed.data.eventId,
      articleId: parsed.data.articleId,
      clientKey: ip,
    });
  } catch {
    /* no bloquear redirect */
  }

  return NextResponse.redirect(parsed.data.to, 302);
}
