import { NextResponse } from "next/server";
import { getServerNowBySlug } from "@/lib/timeline/public-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const data = await getServerNowBySlug(slug);
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
