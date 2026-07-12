import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { incrementContentMetric } from "@/lib/distribution/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["ARTICLE_VIEW", "EVENT_VIEW"]),
  articleId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
});

/**
 * POST /api/metrics/view — registra ARTICLE_VIEW / EVENT_VIEW.
 * Nunca bloquea UX; falla en silencio.
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (parsed.data.kind === "ARTICLE_VIEW" && !parsed.data.articleId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (parsed.data.kind === "EVENT_VIEW" && !parsed.data.eventId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    await incrementContentMetric({
      kind: parsed.data.kind,
      articleId: parsed.data.articleId,
      eventId: parsed.data.eventId,
      clientKey: ip,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
