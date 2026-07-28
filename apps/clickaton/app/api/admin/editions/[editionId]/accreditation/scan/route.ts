import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AccreditationError } from "@/lib/accreditation/errors";
import { resolveByQrToken, resolveByShortCode } from "@/lib/accreditation/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

const rate = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, max = 60) {
  const now = Date.now();
  const row = rate.get(key);
  if (!row || row.reset < now) {
    rate.set(key, { count: 1, reset: now + 60_000 });
    return true;
  }
  row.count += 1;
  return row.count <= max;
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  if (!rateLimit(`${user.id}:${editionId}`)) {
    return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    qr?: string;
    shortCode?: string;
  };

  try {
    const actor = { id: user.id, email: user.email, globalRole: user.globalRole };
    if (body.qr) {
      const data = await resolveByQrToken({ editionId, qrPlaintext: body.qr, actor });
      return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.shortCode) {
      const data = await resolveByShortCode({ editionId, shortCode: body.shortCode, actor });
      return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "QR_OR_CODE_REQUIRED" }, { status: 400 });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
