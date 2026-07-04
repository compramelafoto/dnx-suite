import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getAudienceRecipients, countAudienceRecipients, type AudienceFilters } from "@/lib/email-marketing/audience";

export const dynamic = "force-dynamic";

const MAX_CAMPAIGN_RECIPIENTS = 50000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  await params; // consume
  const body = await req.json().catch(() => ({}));
  const audienceJson = body.audienceJson as AudienceFilters | undefined;

  const filters: AudienceFilters = audienceJson ?? {};

  const [count, sample] = await Promise.all([
    countAudienceRecipients(filters),
    getAudienceRecipients(filters, { limit: 20 }),
  ]);

  return NextResponse.json({
    count,
    sample: sample.map((r) => ({
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      role: r.role,
    })),
    maxAllowed: MAX_CAMPAIGN_RECIPIENTS,
    canSend: count <= MAX_CAMPAIGN_RECIPIENTS && count > 0,
  });
}
