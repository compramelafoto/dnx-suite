import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import {
  getPublicPromptsBySlug,
  isPaidParticipantForEdition,
  resolveEditionIdBySlug,
} from "@/lib/timeline/public-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const edition = await resolveEditionIdBySlug(slug);
  if (!edition) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const user = await getClickatonAuthUser();
  const participantPaid = user
    ? await isPaidParticipantForEdition({
        editionId: edition.id,
        userId: user.id,
        email: user.email,
      })
    : false;

  const data = await getPublicPromptsBySlug(slug, { participantPaid });
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ...data,
      access: participantPaid ? "PARTICIPANT_PAID" : "PUBLIC_LOCKED",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
