import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getClfPublicOrigin,
} from "@/lib/clf-event-sync/urls";
import {
  incrementContentMetric,
  isSafeExternalRedirect,
} from "@/lib/distribution/metrics";
import { appendInfospotAttributionToClfUrl } from "@/lib/public-coverage/clf-attribution";

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
  authorId: z.string().optional(),
});

/**
 * GET /api/r?to=...&kind=...&articleId=...&authorId=...
 * Registra clic y redirige. Nunca bloquea al usuario si falla el tracking.
 * La URL `to` ya debe incluir source=infospot&is_author=… (buildTrackedHref).
 */
export async function GET(req: NextRequest) {
  const parsed = schema.safeParse({
    to: req.nextUrl.searchParams.get("to"),
    kind: req.nextUrl.searchParams.get("kind") || "CLF_REGISTRATION_CLICK",
    eventId: req.nextUrl.searchParams.get("eventId") || undefined,
    articleId: req.nextUrl.searchParams.get("articleId") || undefined,
    authorId: req.nextUrl.searchParams.get("authorId") || undefined,
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

  // Refuerza atribución al redactor en la URL final a CLF.
  const authorNum = parsed.data.authorId ? Number(parsed.data.authorId) : null;
  const redirectTo = appendInfospotAttributionToClfUrl(parsed.data.to, {
    articleId: parsed.data.articleId,
    eventId: parsed.data.eventId,
    authorId:
      authorNum != null && Number.isFinite(authorNum) && authorNum > 0
        ? authorNum
        : null,
  });

  if (!isSafeExternalRedirect(redirectTo, allowed)) {
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

  return NextResponse.redirect(redirectTo, 302);
}
